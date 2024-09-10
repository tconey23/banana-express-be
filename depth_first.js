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

async function dfsShortestPath(startArticle, endArticle, visited = new Set(), path = []) {
    visited.add(startArticle);
    path.push(startArticle);

    if (startArticle === endArticle) {
        return path;
    }

    const links = await getWikipediaLinks(startArticle);
    console.log(`Exploring ${startArticle}:`, links);

    for (const link of links) {
        if (!visited.has(link)) {
            const result = await dfsShortestPath(link, endArticle, visited, [...path]);
            if (result) {
                return result;
            }
        }
    }

    return null; // No path found
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
    const start = 'Miami'; // Example start article
    const end = 'Banana';  // Example end article
    const path = await dfsShortestPath(start, end);
    
    if (path) {
        console.log('Path found:', path.join(' -> '));
        console.log('Writing path to file...');
        writePathToFile(path);
    } else { 
        console.log('No path found.');
    }
}

findPath();