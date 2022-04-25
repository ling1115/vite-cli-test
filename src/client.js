console.log('[vite] is connecting...');

// 1. 获取请求地址
const host = location.host;

// 2. 建立一个 socket 通讯: 通讯地址, 唯一key, 客户端-服务端可互相通信
const socket = new WebSocket(`ws://${host}`, 'vite-hmr');

// 3. 监听通信, 获取数据然后处理
socket.addEventListener('message', async ({ data }) => {
    handleMessage(JSON.parse(data)).catch(console.error);
})

// 4. 处理数据
async function handleMessage(payload){
    // 4.1 根据不同类型进行处理
    switch(payload.type){
        /** 1. 如果已经连接过, 则每3秒发送一个心跳
         * 因为 websocket 长连接有默认的超时时间(1分钟, 由proxy_read_timeout决定)
         * 超过一定时间没有发送任何信息, 连接会自动断开
         */
        case 'connected':
            console.log('[vite] connected.');
            setInterval(() => socket.send('ping'), 30000);
            break;
        // 2. 如果是更新状态
        case 'update':
            payload.updates.forEach(async (update)=>{
                // 2.1 如果是 js 文件更新
                if(update.type === 'js-update'){
                    console.log('[vite] js update...');
                    await import(`/target/${update.path}?t=${update.timestamp}`);
                    location.reload();
                }
            })
            break;
    }
}

// 4.2 定义全局方法: 处理 css 文件, 因为 client 是放在 html 中的, 所以是全局的
const sheetMap = new Map();

export function updateStyle(id, content){
    let style = sheetMap.get(id);
    if(!style){
        let style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.innerHTML = content;
        document.head.appendChild(style);
    }else{
        style.innerHTML = content;
    }
    // 缓存起来
    sheetMap.set(id, style);
}

export function rmStyle(id){
    const style = sheetMap.get(id);
    if(style){
        document.head.removeChild(style);
    }
    // 删除缓存
    sheetMap.delete(id);
}