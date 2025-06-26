// const BabelPluginImport = require('babel-plugin-import'); // No longer needed with this structure

module.exports = {
  plugins: [
    {
      plugin: require('babel-plugin-import'),
      options: {
        libraryName: 'antd',
        libraryDirectory: 'es',
        style: true,
      },
    },
  ],
}; 