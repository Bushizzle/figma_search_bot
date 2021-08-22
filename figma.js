require("dotenv").config();
const fetch = require('node-fetch');
const TEAM_ID = process.env.FIGMA_TEAM_ID;
// https://www.figma.com/files/project/22493983/Project-1?fuid=932981805559254714
const PROJECTS_IDS = process.env.FIGMA_PROJECTS.split(',');
const { NODE_TYPES, DICTIONARY } = require('./config.json');
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;

if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function(str, newStr){

        // If a regex pattern
        if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') {
            return this.replace(str, newStr);
        }

        // If a string
        return this.replace(new RegExp(str, 'g'), newStr);

    };
}

const loadDocuments = async () => {
    const team = await fetch(`https://api.figma.com/v1/teams/${TEAM_ID}/projects`, {
        headers: {
            Authorization: `Bearer ${FIGMA_TOKEN}`,
            // "Access-Control-Allow-Origin": "*",
            // "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
        },
    }).then(res => res.json());
    console.log('Teams data loaded successfully. Loading projects...');

    const projects = await Promise.all(
        team.projects
            .filter(({id}) => PROJECTS_IDS.includes(id))
            .map(({id}) => {
                return fetch(`https://api.figma.com/v1/projects/${id}/files`, {
                    headers: {
                        Authorization: `Bearer ${FIGMA_TOKEN}`,
                    },
                }).then(res => res.json());
            })
    );
    console.log('Projects data loaded successfully. Loading documents, it might take a while...');

    const files = projects.reduce((res, project) => [...res, ...project.files], []);

    const documents = await Promise.all(
        files.map(({key}) => {
            return fetch(`https://api.figma.com/v1/files/${key}`, {
                headers: {
                    Authorization: `Bearer ${FIGMA_TOKEN}`,
                },
            }).then(res => res.json());
        })
    );

    console.log(`${documents.length} documents data loaded successfully, app is ready to go`);

    return {
        team,
        projects,
        files,
        documents,
    };
}

function collector(o, text) {
    const results = [];

    const collect = (o, key, parentPath = []) => {
        const path = typeof o.id === 'string' ? [...parentPath, o.id] : parentPath;
        if (typeof o?.name === 'string' && o?.name?.toLowerCase?.().includes(key?.toLowerCase?.())) results.push({ name: o.name, type: o.type, id: o.id, path});
        if (o.children instanceof Array) o.children.forEach(child => collect(child, key, path));
    }

    collect(o, text);

    return results;
}

function arrayCollector(documents, files, text) {
    let results = [];
    documents.forEach(({document, name}, i) => {
        results = [
            ...results,
            ...collector(document, text)
                .map(node => {
                    const id = node.id.split(':');
                    return {
                        ...node,
                        key: files[i].key,
                        url: `https://www.figma.com/file/${files[i].key}/${name.replaceAll(' ', '-')}?node-id=${id[0]}%3A${id[1]}`,
                    }
                })];
    });
    return results;
}

const searchNodes = ({ documents, files }, searchRequest, nodeTypes=NODE_TYPES) => {
    return arrayCollector(documents, files, searchRequest).filter(({type}) => nodeTypes.includes(type));
};

const mapSearchResponse = (nodes) => {
    let resultString = '';

    NODE_TYPES.forEach((type) => {
        if (nodes.some(node => node.type === type)) {
            resultString += `\n${DICTIONARY[type]}: \n`
            nodes
                .filter(node => node.type === type)
                .forEach(({name, url}) => {
                    resultString += `${name}: ${url}\n`;
                });
        }
    });

    if (!resultString.length) resultString = 'Nothing found. Sorry, bro';

    return resultString;
};

module.exports = {
    loadDocuments,
    searchNodes,
    mapSearchResponse,
}