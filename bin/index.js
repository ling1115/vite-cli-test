#!/usr/bin/env node
/** #!/usr/bin/env node
 * 表明该脚本文件要使用node执行
 * /usr/bin/env: 告诉用户到path目录下去寻找node
 */

// 引用工具
const webpack = require('webpack');
const minimist = require('minimist');
const path = require('path');
// 引入内置配置
const bulitInWebpackConfig = require('../webpack.config');

// 要求用户根目录下配置的文件名取: demo-cli.config.js
const fname = 'demo-cli.config.js';

/*
    Node.js 程序启动后可以直接从process.argv中读取到参数列表：
        console.log(process.argv);
        =>: ['/bin/node', '/tmp/index.js', '--beep=boop', '-t', '-z', '12', '-n5', 'foo', 'bar']
    
    minimist 是一个专门用于处理Node.js启动参数的库，可以将 process.argv 中的参数列表转换成更加易于使用的格式：
        const args = require('minimist')(process.argv.slice(2));
        console.dir(args);
        =>: { _: [ 'foo', 'bar' ], beep: 'boop', t: true, z: 12, n: 5 }
    
    经过minimist处理后的参数是一个对象,取值: args._[0]
*/
// 1. 处理参数
const args = minimist(process.argv.slice(2));

// 4. 自定义命令: 存命令
const __commands = {};
/** 插件机制
 * 向外暴露一些能力，外部根据这些能力可以自定义一些方法或行为
 * 内部可以将这些方法或行为手机起来，用在内部的流程环节中
 * 
 * 即：将内部的流程暴露给外部，让用户可以在某些环节注入想要的能力，高扩展性
 */

/**
 * 将api暴露给用户
 * 然后用户将命令名字和命令对应的实现反馈给我们
 * 拿到用户想要执行的命令和命令对应的实现后在对应的时间点触发
 */
// 4.1 暴露api
const api = {
    // 4.2 自定义命令
    registerCommands(name, impl){
        const command = __commands[name];
        if(!command){
            __commands[name] = impl;
        }
        console.log('0 -- __commands: ', __commands);
    },
    chainWebpack(){},
}

// 2. bulid 打包方法
const runWebpackBulid = ()=>{
    webpack(bulitInWebpackConfig, (err,stats)=>{
        // 错误先行
        if(err || stats.hasErrors()){
            return console.log('bulid error.');
        }
        console.log('bulid success.');
    })
}

// 3. 支持用户根目录下配置一个文件
const readLocalOption = ()=> new Promise((resolve)=>{
    // path.join(): 将多个参数字符串合并成一个路径字符串
    // process.cwd(): 当前node.js进程执行时的文件夹路径 --工作目录
    // __dirname: 被执行的 js 文件的地址 -- 文件所在目录
    // 3.1 读取目录文件
    const config = require(path.join(process.cwd(), fname)) || {};
    console.log('00 -- config:',config)
    // 支持配置插件: 命令
    const { plugins: { commands = [] } = {} } = config;
    if(commands.length){
        console.log('0 -- commands: ', commands);
        commands.forEach(command => {
            console.log('11 -- command: ', command);
            command(api);
        });
    }
    console.log('3 -- __commands', __commands);
    // resolve结果
    resolve(__commands);
})

// 4. 读取配置文件之后打包, 或者直接执行打包, 便实现一个简单的cli
// readLocalOption().then(()=>{
    // runWebpackBulid();
// });

readLocalOption().then((commands)=>{
    console.log('4 -- args: ', args);
    const command = args._[0];
    console.log(' 5-- command', command);
    console.log(' 5-- commands[command]', commands[command]);
    if(commands[command]){
        commands[command]();
    }else{
        runWebpackBulid();
    }
})