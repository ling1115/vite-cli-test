/** 理解流程
* 1.起一个 node 服务
* 2.模版项目的文件，就都走静态资源路径了
* 3.html 返回
* 4.html 返回之前呢，塞一个 client 进去，<script src="/a/client" type="module"/>

    * 在html中预先塞入一个客户端文件，让加载html文件时顺便加载内置客户端代码: 发请求获取客户端代码
  
    
* 5.写这个接口 /a/client -> 内置的 client.js -> 实现热更新HMR

    * 让客户端和服务端已经创建websocket连接，在后端发生改变后可以把更新推送到前端，前端实现个更新

* 6.server - websocket - client
* 7.监听文件变更（三方库）-> 封装一个数据结构（transformCode 变更） -> websocket -> client
* 8.其它文件 .css .jsx 的处理
* 9.transformCss: css -> js -> createElement('style') -> <head> <sytle>...</style> </head>
* 10.transformJSX: .jsx -> .js (引用三方，本地) / 三方（缓存） + 本地（拼路径）
* 11.plugin 系统等
 */

// 1. node环境
import express from 'express';
import { createServer } from 'http';
import { join, extname, posix } from 'path';
import { readFileSync } from 'fs';
import chokidar from 'chokidar';
import WebSocket from 'ws';
// 引入代码转换方法
import { transformCode, transformCss, transformJSX } from './transform';


const targetRootPath = join(__dirname, '../target');

/** esm 机制: import 的内容都会走请求去拉取资源
 * 我们自己一个父亲, 就可以对这些请求的返回进行拦截处理, 返回我们处理过后的内容
 * 整个应该就完全基于 node 服务, 静态资源加载, 没有编译构建的过程, 肯定就会很快了
 */

// 5 创建一个 websocket 服务, 封装 send 方法, 实现热更新
function createWebSocketServer(server) {
  const wss = new WebSocket.Server({ noServer: true })

  server.on('upgrade', (req, socket, head) => {
    if (req.headers['sec-websocket-protocol'] === 'vite-hmr') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'connected' }));
  });

  wss.on('error', (e) => {
    if (e.code !== 'EADDRINUSE') {
      console.error(
        chalk.red(`WebSocket server error:\n${e.stack || e.message}`),
      );
    }
  });

  return {
    send(payload) {
      const stringified = JSON.stringify(payload);
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(stringified);
        }
      });
    },

    close() {
      wss.close();
    },
  }
}

// 6. 监听文件
function watch(){
    return chokidar.watch(targetRootPath,{
        ignored:['**/node_modules/**', '**/.cache/**'],
        ignoreInitial: true,
        ignorePermissionErrors: true,
        disableGlobbing: true
    })
}

// 获取文件短名称
function getShortName(file, root) {
    return file.startsWith(root + '/') ? posix.relative(root, file) : file;
}

// 7. 处理热更新
function handleHMRUpdate(opts){
    const {file, ws} = opts;
    const shortFile = getShortName(file, targetRootPath);
    const timestamp = Date.now();
    let updates
    if (shortFile.endsWith('.css') || shortFile.endsWith('.jsx')) {
        console.log(shortFile)
        updates = [
            {
                type: 'js-update',
                timestamp,
                path:  `/${shortFile}`,
                acceptedPath: `/${shortFile}`
            }
        ]
    }

    ws.send({
        type: 'update',
        updates
    })
}

// vite 的基本功能和能力: dev
export async function dev(){
    // 1.1 拦截入口请求, 返回给用户处理国的 html 文件
    const app = express();
    // 2 入口请求
    app.get('/', (req,res)=>{
        // 2.1 设置content-type
        res.set('Content-Type', 'text/html');
        // 2.2 拿到 html 文件的绝对路径
        const htmlPath = join(__dirname, '../target', 'index.html');
        // 2.3 根据路径去读取文件, 获取文件字符串
        let html = readFileSync(htmlPath, 'utf-8');
        /** 2.4 将客户端代码(包括热更新)塞入 html 的 head 标签中, 发送给浏览器
         * 将 <head> 替换成以下, 并给 script 标签指定客户端文件路径
         * 设置 type="module" : 允许执行导入导出操作, 表明是 esm 模块, 就篮球都会发起请求获取数据
         */
        html = html.replace( '<head>', `<head>\n <script type="module" src="/@vite/client"></script>`).trim();
        res.send(html);
    })

    // 3 获取客户端代码, 把客户端代码塞给html
    app.get('/@vite/client', (req,res)=>{
        res.set('Content-Type', 'application/javascript');
        res.send(
            // 3.2 使用 esbulid 将 js 代码转出 esm 格式 再返回浏览器, 因为浏览器只能支持原始的 esm 格式
            transformCode({
                code: readFileSync(join(__dirname, 'client.js'), 'utf-8')
              }).code
        );
    })

    // 4 处理静态文件: 所有 target 下的文件都拦截, 然后返回给浏览器能够认识的
    app.get('/target/*', (req,res)=>{
        // console.log('path ===>', req.path); // /target/main.js

        // 4.1 取完整路径
        const filePath = join(__dirname, '..', req.path.slice(1)); // req.path.slice(1): 去掉第一个'/'

        // 4.2 给静态文件一个 flag
        if ('import' in req.query) {
            res.set('Content-Type', 'application/javascript');
            res.send(`export default "${req.path}"`);
            return;
        }

        /**  4.3 根据文件名后缀进行代码转换处理
         * 对不同类型的文件做不同的处理, 返回的是浏览器能够认识的结构, 比如: 
         *      如果是 jsx 文件, 就需要转出  esm 格式的 js
         *      如果是 css 文件, 就需要放进 style 标签, 然后 赛道 html 的 head 中
         */
        switch(extname(req.path)){
            case '.svg':
                res.set('Content-Type', 'image/svg+xml');
                res.send(
                    readFileSync(filePath, 'utf-8')
                );
                break;
            case '.css':
                // 4.4 将 css 文件转换成 js 类型: 将样式封装成 style 标签, 放进 head 标签里
                // 因为 css 文件与 html 没有关联, 直接返回 .css 文件样式没有作用在页面上
                res.set('Content-Type', 'application/javascript');
                res.send(
                    transformCss({
                        path: req.path,
                        code: readFileSync(filePath, 'utf-8')
                    })
                );
                break;
            default:
                // 4.5 处理 jsx 文件
                res.set('Content-Type', 'application/javascript');
                res.send(
                    transformJSX({
                        appRoot: join(__dirname, '../target'),
                        path: req.path,
                        code: readFileSync(filePath, 'utf-8')
                    }).code
                );
                break;
        }
     })

    const server = createServer(app);

    const ws = createWebSocketServer(server);
    // 服务启动后 监听文件变化
    watch().on('change', async (file)=>{
        handleHMRUpdate({file, ws});
    })

    const port = '3002';
    server.listen(port, ()=>{
        console.log('App is running at 127.0.0.1:'+port);
    })

}