# singlecmd-cli-template
A single-command CLI template for dulu



```shell
pock -d <dir> # 指定controller目录, 默认不监听目录
pock -d <dir1> <dir2> #可以指定多个目录
pock -w -d <dir> # 监听模式, 会自动重启
pock -f <file> # 单独指定文件
pock -f <file1> <file2> # 可以指定多个文件
pock -w -f <file> # 监听文件变化重启
pock -h 127.0.0.1 -p 3000 -d <dir> # h --host, p --port
pock --config <file> # 指定配置文件, 配置文件和其他所有选项冲突
pock -C -d <dir> # C --cors
pock -S -C cert.pem -K key.pem -d <dir> # S --ssl, C --cert, K --key, 所有接口变为https
pock -P www.baidu.com -t 192.168.0.1:3000 # 代理www.baidu.com到192.168.0.1:3000, P --proxy, t --to, -t的默认值是当前服务器的host和port
pock --wechat /wechat-config --appId aaa --secret bb # 微信授权
```

考虑路由冲突的情况, Done

看下哪些依赖是可以按需加载的, dulu 也看下

检查下每个异常, log提示开头的大小写, 统一下, Done

考虑端口被占用的情况, 参考http-server的处理, Done

暂时不考虑代理服务器的https

考虑代理采用DNS劫持还是流量劫持

考虑路由404的情况, Done

考虑出现异常就不要自动重启了, 也许涉及进程通信, Done

不允许对自己进行代理

考虑下目录为空, Done

考虑文件和目录中找不到一个controller或无法解析, Done

考虑让cors支持自定义头部, 参考https://github.com/koajs/cors, Done

```
--config [string] 可选, 不一定要指定文件, 默认找当前目录下的.pockrc.js/.pockrc.json/.pockrc.yml/.pockrc.yaml, 默认忽略其他所有选项
-d, --dirs Array[string] 可选, 必须指定至少一个文件, 和-f冲突
-f, --files Array[string] 可选, 必须指定至少一个文件, 和-d冲突
-P, --proxy [string] 可选, 必须指定一个host
--wechat [string] 可选, 不一定要指定path, 默认/wechat-config, 但是必须要指定--appid和--secret done
# 以上5个选项必须要指定一个 done

-w, --watch [boolean] 可选
-h, --host [string] 可选, 不一定要指定地址, 默认0.0.0.0
-p, --port [string] 可选, 不一定要指定端口, 默认3000
-C, --cors [boolean] 可选
-S, --ssl [boolean] 可选, 必须要指定-c和-k done
-c, --cert [string] 配合-S, 必须指定文件
-k, --key [string] 配合-S, 必须指定文件
-t, --to [string] 可选, 不一定要指定host和port, 默认当前服务器地址
--appId [string] 配合--wechat, 必须指定appId
--secret [string] 配合--wechat, 必须指定secret
--help
--version
```



```yaml
---
dirs: ./test # 可以是字符串, 也可以是数组, default null
files: ./test.js # 可以是字符串, 也可以是数组, default null
proxy: www.baidu.com # 字符串, default null
wechat: # 对象, default null
  appId: aaa # 字符串
  secret: bbb # 字符串
  path: /wechat-config # 可选, 字符串, default /wechat-config
watch: true # boolean, default false
host: 127.0.0.1 # default 0.0.0.0
port: 3000 # default 3000
cors: # 可以是boolean, 可以是对象, boolean则按默认配置来, default false
  allowMethods:
    - aaa
    - bbb
  allowHeaders:
    - aaa
    - bbb
ssl: # default null
  cert: ./test.pem # default null
  key: ./key.pem # default null
to: 127.0.0.1:3000 # default null
...
```



父进程无论何种原因退出, 都要带走子进程, Done

子进程因为自己的异常退出, 则通知父进程, 父进程不再拉活子进程, 父进程退出, Done

子进程因为其他外部作用退出, 则父进程拉活子进程, Done