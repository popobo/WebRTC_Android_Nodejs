"use strict";

// OS 模块可以查看当前主机系统的相关信息，如网络，CPU，内存，目录，用户信息，操作系统，运行时间等
var os = require("os");
// a simple, rfc 2616 compliant file streaming module for node
// 一个简单的、符合rfc 2616标准的节点文件流模块
var nodeStatic = require("node-static");
var https = require("https");
var socketIO = require("socket.io");
var fs = require("fs");
// 记录日志
var log4js = require("log4js");

// 私钥和公钥文件
var options = {
    key: fs.readFileSync("./cert/privkey.pem"),
    cert: fs.readFileSync("./cert/fullchain.pem")
};

log4js.configure({
    appenders:{
        file:{
            type:"file",
            filename:"app.log",
            layout:{
                type:"pattern",
                pattern:"%r %p - %m"
            }
        }
    },
    categories:{
        default:{
            appenders:["file"],
            level:"debug"
        }
    }
});

var logger = log4js.getLogger();


var fileServer = new(nodeStatic.Server)();
var app = https.createServer(options, function(req, res){
    fileServer.serve(req, res);
}).listen(443);

var io = socketIO.listen(app);
// on(event: string | symbol, listener: (...args: any[]) => void): this;
io.sockets.on("connection", function(socket){
    // convenience function to log server messages on the client
    function log(){
        var array = ["Message from server:"];
        // push.apply 合并数组是把后一个数组的值依次push进前一个数组，使前一个数组发生改变，并且只能两个数组之间发生合并
        array.push.apply(array, arguments);
        // socket.emit 给连接对端发消息
        socket.emit("log", array);
        
        console.log("bo", array);
    }

    socket.on("message", function(message){
        // for a real app, would be room-only (not broadcast)
        // 广播发送
        // socket.broadcast.emit('message', message);
        var to = message["to"];
        // 转发message时根据其中的to, 来选择发送目标
        logger.info("from:" + socket.id + " to:" + to, message);
        log("from:" + socket.id + " to:" + to, message);
        io.sockets.sockets[to].emit("message", message);
    });

    socket.on("create or join", function(room){
        logger.info("Received request to create or join room" + room);
        log("Received request to create or join room" + room);
        
        // 获取房间
        var clientsInRoom = io.sockets.adapter.rooms[room];
        // 获取房间中用户数量
        var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
        logger.info("Room " + room + " now has " + numClients + " client(s)");
        log("Room " + room + " now has " + numClients + " client(s)");
        
        // == 可能会进行类型转换后再进行比较
        // === 严格比较, 类型不同直接不等
        if(0 === numClients){
            socket.join(room);
            logger.info("Client ID " + socket.id + " created room " + room);
            log("Client ID " + socket.id + " created room " + room);
            socket.emit("created", room, socket.id);
        } else {
            // 某人加入房间时, 向其他人发送此人的socketId
            logger.info("Client ID " + socket.id + " joined room " + room);
            log("Client ID " + socket.id + " joined room " + room);
            // 向房间内其他用户发送join以及房间名和加入房间的用户的socket.id
            io.sockets.in(room).emit("join", room, socket.id);
            socket.join(room);
            // 向加入房间的客户端发送"joined"
            socket.emit("joined", room, socket.id);
            io.sockets.in(room).emit("ready");
        }
    }); 

    socket.on("ipaddr", function(){
        // 获取网络接口
        var iFaces = os.networkInterfaces();
        for(var dev in iFaces){
            iFaces[dev].forEach(function(details){
                if(details.family === "IPv4" && details.address !== "127.0.0.1"){
                    socket.emit("ipaddr", details.address);
                }
            });
        }
    });

    socket.on("bye", function(){
        logger.info("received bye");
        log("received bye");
    });

});

