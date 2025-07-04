const path = require('path');

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
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // 生产环境优化
      if (env === 'production') {
        // 启用代码分割
        webpackConfig.optimization.splitChunks = {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            antd: {
              test: /[\\/]node_modules[\\/]antd[\\/]/,
              name: 'antd',
              chunks: 'all',
              priority: 20,
            },
            recharts: {
              test: /[\\/]node_modules[\\/]recharts[\\/]/,
              name: 'recharts',
              chunks: 'all',
              priority: 15,
            },
          },
        };

        // 启用压缩
        webpackConfig.optimization.minimize = true;
        
        // 移除console.log
        webpackConfig.optimization.minimizer.forEach(plugin => {
          if (plugin.constructor.name === 'TerserPlugin') {
            plugin.options.terserOptions.compress.drop_console = true;
          }
        });
      }

      // 别名配置
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        '@': path.resolve(__dirname, 'src'),
      };

      return webpackConfig;
    },
  },
}; 