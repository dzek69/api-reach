module.exports = {
    // testMatch: [],
    collectCoverageFrom: [
        'src/**/*.{mjs,js,jsx,ts,tsx}',
        '!**/*.d.ts'
    ],
    setupFiles: [
        '<rootDir>/test/bootstrap.cjs'
    ],
    testEnvironmentOptions: {
        url: 'http://localhost:8080',
    },
    moduleNameMapper: {
        '^ipaddr.js$': 'ipaddr.js',
        '^uri-js$': 'uri-js',
        '^(.*)\.js$': '$1',
    },
};


