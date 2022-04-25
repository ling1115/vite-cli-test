// 使用 esbuild 将代码转换成 esm 格式
import { transformSync } from 'esbuild';
import { extname, dirname, join } from 'path';
import { existsSync } from 'fs';

// 3.2 将 js 转换成浏览器认识的 esm
// esbuild内置了一些文件处理的loader
// 当esbuild解析到某后缀时，会自动使用该loader进行处理。 
/**
 * sourcemap: 生成源映射文件 .map
 * format: ems 格式
 */
export function transformCode(opts) {
    return transformSync(opts.code, {
        loader: opts.loader || 'js',
        sourcemap: true,
        format: 'esm'
    })
}

// 4.2 将 css 文件转换成 js 类型: 就是在 head 插入一个 css 类型的 style 标签
export function transformCss(opts){
    return `
        import { updateStyle } from '/@vite/client';

        const id = "${opts.path}";
        const css = "${opts.code.replace(/\n/g, '')}";

        updateStyle(id, css);
        export default css;
  `.trim()
}

// 4.3 将jsx文件转换成js类型
export function transformJSX(opts){
    // 判断后缀
    const ext = extname(opts.path).slice(1); // 去掉'/' 获取到jsx
    // const ret = transformCode({ // jsx 转换成 esm格式的js
    //     loader: ext,
    //     code: opts.code
    // });

    const ret = transformCode({ // jsx -> js
        loader: ext,
        code: opts.code
    });
    
    let { code } = ret;
    
    /*
        esm机制: 每一个import 都会发起请求拉取资源
        index.html中遇到/target/main.jsx时 去发去请求 比如：localhost:3002/target/main.jsx,
        在处理转换jsx文件时 也分析其内部的import, 然后拼接路径 再通过发起请求静态资源 返回给浏览器
    */
    
    /*  分析代码字符串中的import
        import type { XXXX } from 'xxx.ts';
        import React from 'react';
        下面的正则取出 from 后面的 "react", 然后通过有没有 "." 判断是引用的本地文件还是三方库
        本地文件就拼路径
        三方库就从我们预先编译的缓存里面取
        /\bimport(?!\s+type)/: 如果匹配到import并且其后边不是type
    */
    code = code.replace(
        /\bimport(?!\s+type)(?:[\w*{}\n\r\t, ]+from\s*)?\s*("([^"]+)"|'([^']+)')/gm,
        (a, b, c) => {
          let from;
          if (c.charAt(0) === '.') { // 本地文件
            from = join(dirname(opts.path), c);
            const filePath = join(opts.appRoot, from);
            // 判断文件是否存在
            if (!existsSync(filePath)) {
              if (existsSync(`${filePath}.js`)) {
                from = `${from}.js`
              }
            }

            // 如果是静态文件，加后缀表示为静态资源
            if (['svg'].includes(extname(from).slice(1))) {
              from = `${from}?import`
            }
          }
          else { // 从 node_modules 里来的
            // node_modules 里的, 直接从缓存中取
            // 这里需要先提前把node_modules里的包预先编译并且缓存起来: src/optmize.js
            from = `/target/.cache/${c}/cjs/${c}.development.js`;
          }
          // 拼接完路径之后返回, 后续通过静态资源请求: dev.js中的 app.get('/target/*', (req, res) => {...
          return a.replace(b, `"${from}"`)
        }
    )
    return {
        ...ret,
        code
    }
}