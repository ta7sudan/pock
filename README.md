# Pock
鉴于英语水平太捉急了, 以后 README 还是用中文写, 省事~ (但是英语还是要好好学啊...

一个简单的 cli 小工具, 主要用来日常开发时快速起接口, 以及方便做微信 JS SDK 的授权等.

支持通过命令行选项指定参数, 也支持从配置文件指定参数.



## Usage

```shell
$ pock -f route.js
```

route.js

```javascript
module.exports = {
    'get /test': {
        hello: 'world'
    }
};
```

`GET http://127.0.0.1:3000` 可以得到

```json
{
    "hello": "world"
}
```

`-f` 用来指定一个文件, 文件可以是一组路由或一个 [Fastify Plugin](https://github.com/fastify/fastify/blob/master/docs/Plugins-Guide.md). 文件支持 `.js` `.json` `.yml` `.yaml` 几种格式.

eg.

```javascript
// route.js
module.exports = {
    'get /aaa': {
        aaa: 'aaa'
    },
    'post /bbb': {
        bbb: 'bbb'
    },
    'put /ccc 3000': {
        ccc: 'ccc'
    }
};
```

或者 `.json`

```json
{
    "get /aaa": {
        "aaa": "aaa"
    },
    "post /bbb": {
        "bbb": "bbb"
    },
    "put /ccc 3000": {
        "ccc": "ccc"
    }
}
```

或者 `.yml` 和 `.yaml`

```yaml
# route.yml
get /aaa:
  aaa: aaa
post /bbb:
  bbb: bbb
put /ccc 3000:
  ccc: ccc
```

其中 `3000` 是用来指定接口延迟返回的时间, 单位 ms. HTTP Method 支持所有 Fastify 支持的 method, 但不包括 `all`(其实就是写的时候我把它给忘了, 然后现在懒得改了...).

如果需要更灵活地定制, 可以使用 `.js` 文件, 提供了完整的可编程能力.

```javascript
module.exports = {
	'get /test/:demo': async (req, res) => {
		console.log(req.params.demo);
		return {
			hello: 'world'
		};
	}
};
```

或

```javascript
module.exports = {
	'get /test': [async (req, res) => {
		console.log('before handler 0');
	}, async (req, res) => {
		console.log('before handler 1');
	}, async (req, res) => {
		console.log('handler');
		return {
			hello: 'world'
		};
	}]
};
```

或

```javascript
async function plugin(fastify, options) {
	fastify.get('/test', async (req, res) => options);
}

plugin.options = {
	some: 'value'
};

module.exports = plugin;
```

一个 `.js` 文件导出的值可以是一个对象, 也可以是一个 [Fastify Plugin](https://github.com/fastify/fastify/blob/master/docs/Plugins-Guide.md). 对象被视为一组路由, 而插件提供了更多的功能.

路由以 key-value 的形式指定, key 包含了 HTTP Method 和 path 以及可选的延迟时间.

```
'<method> <path> [timeout]`: <value>
```

value 可以是一个对象, 一个数组, 一个函数, 一个函数的数组. 对象或不包含函数的数组被视为响应的 body, 会被转换成 JSON 值. 函数会被作为 [Fastify Routes](https://github.com/fastify/fastify/blob/master/docs/Routes.md) 的 `handler`, 而函数的数组则最后一个函数被作为 `handler`, 前面的被作为 `beforeHandler`.

需要注意的是路由受到 Fastify 默认的一些限制, 比如请求的 body 最大不能超过 `bodyLimit`, 路径参数的长度不能超过 `maxParamLength` 等. 如果需要突破这些限制(不包括 `maxParamLength`), 请使用 Fastify Plugin 的形式.



## Options

* `--config` 指定配置文件, eg. `pock --config ./.pockrc.yml`
* `-d, --dirs` 指定一个目录, pock 会递归地查找目录中的 `.js` `.json` `.yml` `.yaml` 文件并注册路由或插件
* `-f, --files` 指定一个文件, 将其导出的内容注册为路由或插件
* `-P, --prefix` 指定代理的 path, 参考 [fastify-http-proxy](https://github.com/fastify/fastify-http-proxy)
* `-u, --upstream` 指定代理的 upstream, 参考 [fastify-http-proxy](https://github.com/fastify/fastify-http-proxy)
* `-m, --mitm` 启动中间人代理, 指定要劫持的 Host, eg. `www.example.com:443`, 同时必须指定 `-t`
* `-t, --to` 指定将流量劫持到某个 Host, eg. `127.0.0.1:3000`, 仅在 `-m` 指定时有效
* `--wechat` 启动微信 JS SDK 授权接口, 用来指定接口 path, 默认 `/wechat-config`, 同时必须指定 `--appId` 和 `--secret`
* `--appId` 指定微信开发者的 appid, 仅在 `--wechat` 指定时有效
* `--secret` 指定微信开发者的 secret, 仅在 `--wechat` 指定时有效
* `-w, --watch` 监听文件或目录的变化, 重启服务器, 默认 `false`
* `-h, --host` 指定服务器绑定的 IP, 默认 `0.0.0.0`
* `-p, --port` 指定服务器绑定的端口, 默认 3000
* `-C, --cors` 开启所有接口的 CORS, 默认 `false`
* `-S, --ssl` 启动 HTTPS 服务器, 默认 `false`, 同时必须指定证书和私钥的位置 `--cert` 和 `--key`
* `-c, --cert` 证书文件的位置, 仅在 `-S` 指定时有效
* `-k, --key` 私钥的位置, 仅在 `-S` 指定时有效
* `--version` 版本号
* `--help` 帮助文档

如果指定了配置文件则忽略其他所有选项.



## Configuration

pock 支持配置文件, 默认查找当前目录下的 `.pockrc.js` `.pockrc.json` `.pockrc.yml` `.pockrc.yaml`. 支持 `.js` `.json` `.yml` `.yaml` 几种格式.

以 `.yml` 为例.

```yaml
---
# 所有属性都是可选的, 但是 dirs, files,
# proxy, wechat, mitm 中至少要设置一个
dirs: ./demo # string or Array<string>, default null
files: ./test.js # string or Array<string>, default null
proxy: # Object, default null
  prefix: /api # string, default /
  upstream: http://www.test.com # string, default null
  http2: false # boolean, default false
mitm: # Object, default null
  origin: www.example.com # string, default null
  dest: 127.0.0.1:3000 # string
  host: 127.0.0.1 # string, default 0.0.0.0
  port: 8080 # string, default random
  log: true # boolean, default false
wechat: # Object, default null
  appId: abc # string, default null
  secret: efg # string, default null
  path: /wechat-config # string, default /wechat-config
  method: post # string, default get
  url: http://www.example.com/test # string
  debug: true # boolean, default false
  timestamp: 12345 # integer, default Date.now()/1000
  nonceStr: abcde # string, default random string
  signature: xyz # string
  jsApiList: [uploadImage, previewImage] # Array<string>, default []
watch: true # boolean, default false
host: 127.0.0.1 # string, default 0.0.0.0
port: 3000 # string or number, default 3000
cors: # boolean or Object, default false
  allowMethods:
    - 'PUT'
    - 'DELETE'
ssl: # Object, default null
  cert: ./cert.pem # string, default null
  key: ./key.pem # string, default null
...
```

* `dirs` 支持字符串或数组, 指定一个或多个目录
* `files` 支持字符串或数组, 指定一个或多个文件
* `proxy` 支持 [fastify-http-proxy](https://github.com/fastify/fastify-http-proxy) 的所有配置
* `mitm` 配置中间人代理, 目前只支持 HTTP 代理
  * `origin` 要劫持的目标, `<host>[:<port>]`
  * `dest` 劫持到的地址, `<host>[:<port>]`
  * `host` 代理绑定的 IP
  * `port` 代理绑定的端口
* `wechat` 微信相关的配置
  * `appId` 必填, appid
  * `secret` 必填, secret
  * `path` JS SDK 的凭据 API 地址, 默认 `/wechat-config`
  * `method` 接口支持的方法, 默认 `GET`
  * `url` 使用 JS SDK 的页面的地址, eg. `http://www.example.com/test`
  * `debug` 响应的 JS Ticket 中的 `debug` 字段, 默认 `false`
  * `timestamp` 响应的 JS Ticket 中的 `timestamp` 字段, 默认当前时间
  * `nonceStr` 响应的 JS Ticket 中的 `nonceStr` 字段, 默认随机生成
  * `signature` 响应的 JS Ticket 中的 `signature` 字段, 默认根据微信算法生成
  * `jsApiList` 响应的 JS Ticket 中的 `jsApiList` 字段, 默认从请求的 query, params, body 中获取
* `watch` 是否监听文件或目录变化, 默认 `false`
* `host` 服务器绑定的 IP
* `port` 服务器绑定的端口
* `cors` 是否开启 CORS, 默认 `false`. 也可以是一个对象, 支持 [fastify-cors](https://github.com/fastify/fastify-cors) 的所有配置
* `ssl` 开启 HTTPS
  * `cert` 证书文件位置
  * `key` 私钥位置


