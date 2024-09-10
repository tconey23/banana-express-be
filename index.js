const express = require('express');
const fs = require('fs');
const fetch = global.fetch;

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

let linkCount = 0;

let depth = 1;
const MAX_DEPTH = 2;

const fetchLinks = async (url) => {
    linkCount += 1;
    console.log(linkCount);

    const exclude = ['Template:', 'Template Talk:', 'Category:', 'Wikipedia'];

    try {
        const response = await fetch(url);
        const data = await response.json();
        let linkArray = [];

        if (data.query && data.query.pages) {
            data.query.pages.forEach((pg) => {
                if (pg.links) {
                    pg.links.forEach((link) => {
                        if (!exclude.some(ex => link.title.toLowerCase().includes(ex.toLowerCase()))) {
                            linkArray.push({
                                title: link.title,
                                links: []
                            });
                        }
                    });
                }
            });
        }
        return linkArray;
    } catch (error) {
        console.log('Error fetching links:', error);
        return [];
    }
};

const fetchFeaturedArticle = async () => {
    const date = new Date(Date.now());

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const url = `https://en.wikipedia.org/api/rest_v1/feed/featured/${year}/${month}/${day}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        const featuredArticleTitle = data.tfa ? data.tfa.title : 'No featured article available';
        const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=links&titles=${encodeURIComponent(featuredArticleTitle)}&formatversion=2&pllimit=max`;

        const links = await fetchLinks(apiUrl);

        const featuredArticle = {
            title: featuredArticleTitle,
            links: links.length > 0 ? links : 'No links available'
        };

        fs.writeFileSync('featured_article.json', JSON.stringify(featuredArticle, null, 2));
        console.log('Featured article written to featured_article.json');

        await fetchDepth();

    } catch (error) {
        console.log('Failed to fetch the featured article:', error.message);
    }
};

const fetchDepth = async () => {
    if (depth > MAX_DEPTH) {
        console.log('Max depth reached, stopping recursion.');
        return;
    }

    depth += 1;
    console.log(`Fetching depth level: ${depth}`);

    try {
        const data = fs.readFileSync('featured_article.json', 'utf8');
        const featuredArticle = JSON.parse(data);

        for (const lk of featuredArticle.links) {
            const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=links&titles=${encodeURIComponent(lk.title)}&formatversion=2&pllimit=max`;
            const subLinks = await fetchLinks(apiUrl);
            lk.links = subLinks;

            fs.writeFileSync('featured_article.json', JSON.stringify(featuredArticle, null, 2));

            await fetchDepth();
        }
    } catch (error) {
        console.log('Error reading or updating the file:', error.message);
    }
};




app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// fetchFeaturedArticle();
