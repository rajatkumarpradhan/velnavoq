import {defineConfig} from 'vite';
export default defineConfig({root:'ui',server:{host:'127.0.0.1',port:5173},build:{outDir:'../ui-dist',emptyOutDir:true}});
