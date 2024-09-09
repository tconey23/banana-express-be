const express = require('express');
const fs = require('fs'); // File system module to write files

const app = express();
const port = process.env.PORT || 5001;

app.use(express.json());

// Helper function to delay execution (rate limiting or retry delay)
const sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};

// Function to make requests with exponential backoff
const fetchWithExponentialBackoff = async (url, retries = 5, retryDelay = 1000) => {
    let attempt = 0;

    while (attempt < retries) {
        try {
            const response = await fetch(url);

            if (response.ok) {
                return await response.json(); // Return response if successful
            } else if (response.status === 429) {
                // Handle rate limiting (Too Many Requests)
                console.log(`Rate limited. Waiting for ${retryDelay / 1000} seconds...`);
                
                const retryAfter = response.headers.get('Retry-After');
                if (retryAfter) {
                    // If server provides Retry-After header, respect it
                    await sleep(parseInt(retryAfter) * 1000);
                } else {
                    await sleep(retryDelay); // Fallback to exponential backoff
                }
            } else {
                // Log non-429 HTTP errors
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
        } catch (error) {
            // Log the error and retry
            console.log(`Error: ${error.message}. Retrying in ${retryDelay / 1000} seconds...`);

            // Exponential backoff delay
            await sleep(retryDelay);

            // Double the delay for the next retry
            retryDelay *= 2;
            attempt++;
        }
    }

    // If all retries are exhausted, throw a new error
    throw new Error('Max retries reached');
};

// Modified getRelatedArticles function with rate limiting, depth control, and exponential backoff
const getRelatedArticles = async (articleTitle, depth = 1, maxDepth = 2, maxCallsPerMinute = 60, retryDelay = 1000) => {
    if (depth > maxDepth) {
        // Prevent too much nesting by stopping when maxDepth is reached
        return [];
    }

    console.log(`Fetching related articles for: ${articleTitle}, depth: ${depth}`);

    const url = `https://en.wikipedia.org/api/rest_v1/page/related/${encodeURIComponent(articleTitle)}`;

    try {
        const data = await fetchWithExponentialBackoff(url, 5, retryDelay); // Fetch with backoff

        // Extract related articles and apply rate limiting
        const relatedArticles = await Promise.all(
            data.pages ? data.pages.map(async (page) => {
                // Rate limiting: pause before each request
                await sleep(60000 / maxCallsPerMinute); // Delay to enforce maxCallsPerMinute

                // Fetch related articles for each related article (recursive call)
                const nestedRelatedArticles = await getRelatedArticles(page.title, depth + 1, maxDepth, maxCallsPerMinute, retryDelay);

                return {
                    title: page.title,
                    relatedArticles: nestedRelatedArticles
                };
            }) : []
        );

        return relatedArticles;
    } catch (error) {
        console.log(`Failed to fetch related articles for ${articleTitle}: ${error.message}`);
        return []; // Return an empty array if fetching fails
    }
};

const getFeaturedArticle = async (maxDepth = 2) => {
    const date = new Date(Date.now());

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // months are zero-indexed, so add 1
    const day = String(date.getDate()).padStart(2, '0');
    
    const url = `https://en.wikipedia.org/api/rest_v1/feed/featured/${year}/${month}/${day}`;

    try {
        const data = await fetchWithExponentialBackoff(url, 5, 1000); // Fetch with backoff

        const featuredArticle = {
            title: data.tfa ? data.tfa.title : 'No featured article available',
        };

        // If there is a featured article, fetch its related articles with the specified depth
        if (featuredArticle.title !== 'No featured article available') {
            featuredArticle.relatedArticles = await getRelatedArticles(featuredArticle.title, 1, maxDepth); // Pass the maxDepth here
        }

        // Save the featured article and nested related articles to a JSON file
        fs.writeFile('featuredArticleWithRelated.json', JSON.stringify(featuredArticle, null, 2), (err) => {
            if (err) {
                console.error('Error writing to file', err);
            } else {
                console.log('Featured article with related articles saved to featuredArticleWithRelated.json');
            }
        });
    } catch (error) {
        console.log('Failed to fetch the featured article:', error.message);
    }
};

getFeaturedArticle(4); // You can adjust the maxDepth parameter here

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
