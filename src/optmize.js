// 对node_modules里的包预先编译并且缓存起来
import {build} from 'esbuild';
import {join} from 'path';

const appRoot = join(__dirname,'..'); // 获取根目录
const cache = join(appRoot, 'target', '.cache'); // 获取缓存路径

// import React from 'react' 这里的 react 肯定是从 node_modules 里去拿的
// 可以预先把相关文件从 node_modules 取出来, bulid 成 esm 模块, 放进一个缓存文件找那个
// 这些依赖的三方库一般是不会变更的, 所以可以这样预先处理, 更快

export async function optmize(pkgs=['react', 'react-dom']){
    const ep = pkgs.reduce((c,n)=>{
        c.push(join(appRoot, "node_modules", n, `cjs/${n}.development.js`));
        return c;
    }, []);

    await build({
        entryPoints: ep,
        bundle: true,
        format: 'esm',
        logLevel: 'error',
        splitting: true,
        sourcemap: true,
        outdir: cache,
        treeShaking: 'ignore-annotations',
        metafile: true,
        define: {
            "process.env.NODE_ENV": JSON.stringify("development")
        }
    })
}