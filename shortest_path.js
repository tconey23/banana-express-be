const express = require('express');
const fs = require('fs');
const fetch = global.fetch;

async function getWikipediaLinks(articleTitle) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(articleTitle)}&prop=links&pllimit=max&format=json&origin=*`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        const pages = data.query.pages;
        
        let links = [];
        for (const pageId in pages) {
            if (pages[pageId].links) {
                links = pages[pageId].links.map(link => link.title);
            }
        }
        return links;
    } catch (error) {
        console.error(`Error fetching links for ${articleTitle}:`, error);
        return [];
    }
}

let count = 0

async function bfsShortestPath(startArticle, endArticle) { 
    console.log(`Starting search from ${startArticle} to ${endArticle}`);
    if (startArticle === endArticle) {
        return [startArticle];
    }
    
    const visited = new Set();
    const queue = [[startArticle, [startArticle]]];
    
    while (queue.length > 0) {
        const [currentArticle, path] = queue.shift();
        
        if (visited.has(currentArticle)) {
            continue;
        }
        
        visited.add(currentArticle);
        
        const links = await getWikipediaLinks(currentArticle);
        count += 1
        console.log(count)
        
        for (const link of links) {
            if (link === endArticle) {
                return [...path, link];
            }
            if (!visited.has(link)) {
                queue.push([link, [...path, link]]); 
            }
        }
    }
    
    return null;
}

function writePathToFile(path) {
    try { 
        const jsonPath = 'paths.json';
        fs.writeFileSync(jsonPath, JSON.stringify({ path }, null, 2), 'utf8');
        console.log(`Path successfully written to ${jsonPath}`);
    } catch (error) {
        console.error('Error writing path to file:', error);
    }
}

const findPath = async () => {
    const start = 'Miami';
    const end = 'Banana';
    const path = await bfsShortestPath(start, end);
    
    if (path) {
        console.log('Writing path to file...');
        writePathToFile(path);
    } else {
        console.log('No path found.');
    }
}

findPath();
