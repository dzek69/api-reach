module.exports = {
  "collectCoverageFrom": [
    "src/**/*.{mjs,js,jsx,ts,tsx}",
    "!**/*.d.ts"
  ],
  "setupFiles": [
    "<rootDir>/test/bootstrap.cjs"
  ],
  "testEnvironmentOptions": {
    "url": "http://localhost:8080"
  },
  "moduleNameMapper": {
    "^ipaddr.js$": "ipaddr.js",
    "^uri-js$": "uri-js",
    "^(.*).js$": "$1"
  },
  "transform": {
    "\\.[jt]sx?$": [
      "babel-jest",
      {
        "configFile": "./test/babel.config.cjs"
      }
    ]
  }
};
