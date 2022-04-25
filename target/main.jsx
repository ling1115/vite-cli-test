import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import App from './App.jsx'
// esm机制: 每一个import 都会发起请求拉取资源
// 在index.html中遇到/target/main.jsx时 去发去请求：localhost:3002/target/main.jsx,
// 在处理转换jsx文件时 也分析其内部的import, 然后拼接路径 再通过发起请求静态资源 返回给浏览器

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
)