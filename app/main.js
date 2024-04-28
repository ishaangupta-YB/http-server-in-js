const net = require("net");
const fs = require('fs');
const path = require('path')

let DIRECTORY = __dirname
process.argv.forEach((val, index) => {
    if (val === '--directory' && process.argv[index + 1]) {
        DIRECTORY = process.argv[index + 1];
    }
});
 

const server = net.createServer({ keepAlive: true }, (socket) => {
    socket.on("close", () => {
        socket.end();
        server.close();
    });
    socket.on("data", (data) => {
        const response = parseRequest(data.toString());
        socket.write(response);
        socket.end();
    });


    function parseRequest(httpRequest) {
        const lines = httpRequest.split('\r\n')
        const line = lines[0]
        const [method, urlPath] = line.split(' ')
        if (urlPath === '/') {
            return `HTTP/1.1 200 OK\r\n\r\n`;
        }
        if (urlPath.startsWith('/echo')) {
            const [, , ...content] = urlPath.split('/')
            return formatOkResponse(content.join('/'), 'text/plain')
        }
        if (urlPath.startsWith('/user-agent')) {
            const userAgentHeader = lines.find(l => l.includes('User-Agent'))
            if (userAgentHeader) {
                const value = userAgentHeader.split(':')[1].trim()
                return formatOkResponse(value, 'text/plain')
            }
        }

        if (urlPath.startsWith('/file')) {
            const fileName = urlPath.split('/').filter(Boolean)[1]
            const filePath = path.join(DIRECTORY, fileName)
            if (method === 'GET') {
                return createFileResponse(filePath)
            }
            if (method === 'POST') {
                const fileContents = lines[lines.length - 1]
                return uploadFile(filePath, fileContents)
            }
        }
        return `HTTP/1.1 404 Not Found\r\n\r\n`;

    }

    function formatOkResponse(contentString, contentType) {
        return `HTTP/1.1 200 OK\r\nContent-Type: ${contentType}\r\nContent-length: ${contentString.length}\r\n\r\n${contentString}`
    }

    function createFileResponse(filePath) {
        if (fs.existsSync(filePath)) {
            const fileContents = fs.readFileSync(filePath, { encoding: "utf8" });
            return formatOkResponse(fileContents, 'application/octet-stream')
        }

        return `HTTP/1.1 404 Not Found\r\n\r\n`
    }
    function uploadFile(filePath, fileContents) {
        try {
            fs.writeFileSync(filePath, fileContents)
            return `HTTP/1.1 201 Created success\r\n\r\n`
        } catch (e) {
            console.error(e)
            return `HTTP/1.1 500 Internal Server Error\r\n\r\n`
        }
    }
});

server.listen(4221, "localhost");
