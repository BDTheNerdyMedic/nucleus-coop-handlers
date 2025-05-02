import js from '@eslint/js';
import globals from 'globals';
import json from '@eslint/json';
import markdown from '@eslint/markdown';
import standard from 'eslint-config-standard';
import importPlugin from 'eslint-plugin-import';
import nPlugin from 'eslint-plugin-n';
import promisePlugin from 'eslint-plugin-promise';

export default [
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: {
      js,
      import: importPlugin,
      n: nPlugin,
      promise: promisePlugin
    },
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        Game: 'writable',       // Game configuration (e.g., Game.ExecutableName)
        Context: 'readonly',    // Runtime context (e.g., Context.GetFolder)
        Nucleus: 'readonly',    // Logging and utilities (e.g., Nucleus.Folder.InstancedGameFolder)
        ProtoInput: 'writable', // Input management (e.g., ProtoInput.InstallHook)
        System: 'readonly',     // .NET utilities (e.g., System.IO.Path)
        PlayerList: 'writable'  // Player management
      }
    },
    rules: {
      ...standard.rules,
      'quotes': ['error', 'double'], // Enforce double quotes
      'no-console': 'off',           // Allow console.log for debugging
      'func-names': 'off',           // Allow anonymous functions (e.g., Game.Play)
      'no-underscore-dangle': 'off', // Allow properties like Game._protoInput
      'no-use-before-define': ['error', { functions: false }], // Allow function hoisting
      'max-len': ['warn', { code: 120 }], // Relax line length
      'indent': ['error', 4],        // Enforce 4-space indentation
      'semi': ['error', 'always'],    // Enforce semicolons
      'array-element-newline': ['error', { minItems: 3, multiline: true }],
      'array-bracket-newline': ['error', { minItems: 3 }]
    }
  },
  {
    files: ['**/*.json'],
    plugins: { json },
    language: 'json/json'
    // No explicit rules needed; @eslint/json validates syntax automatically
  },
  {
    files: ['**/*.md'],
    plugins: { markdown },
    language: 'markdown/gfm',
    rules: {
      'markdown/fenced-code-language': ['error', { required: ['javascript', 'json'] }], // Require specific languages
      'markdown/no-empty-links': 'error', // Prevent empty links
      'markdown/no-html': 'warn' // Warn on HTML in Markdown
    }
  }
];