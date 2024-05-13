const net = require('net');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const server = net.createServer((socket) => {
    socket.on('close', () => {
        socket.end();
        server.close();
    });
    socket.on('data', (data) => {
        const request = data.toString();
        const requestLines = request.split('\r\n');
        const firstLine = requestLines[0];
        const [method, requestPath, httpVersion] = firstLine.split(' ');
        const body = requestLines[requestLines.length - 1];
        console.log('Request path: ', requestPath);
        console.log('Full Req:\r\n', request);
        if (requestPath === '/') {
            console.log('Serving index.html');
            socket.write('HTTP/1.1 200 OK\r\n\r\n');
        } else if (requestPath.startsWith('/echo')) {
            const randomString = requestPath.split('/echo/')[1] ?? '';
            console.log('Random string: ', randomString);

            const acceptEncodingHeader = requestLines.find((line) => line.toLowerCase().startsWith('accept-encoding'));
            const supportedEncodings = ['gzip', 'deflate'];
            let contentEncodingHeader = '';
            if (acceptEncodingHeader) {
                const acceptedEncodings = acceptEncodingHeader
                    .split(':')[1]
                    .trim()
                    .split(',')
                    .map((encoding) => encoding.trim().toLowerCase());
                const supportedEncoding = acceptedEncodings.find((encoding) => supportedEncodings.includes(encoding));
                if (supportedEncoding) {
                    contentEncodingHeader = supportedEncoding;
                }
            }
            let responseHeaders = `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n`;
            let responseBody = randomString;
            if (contentEncodingHeader === 'gzip') {
                responseHeaders += 'Content-Encoding: gzip\r\n';
                responseBody = zlib.gzipSync(randomString);
            }
            responseHeaders += `Content-Length: ${Buffer.byteLength(responseBody)}\r\n\r\n`;
            socket.write(responseHeaders);
            socket.write(responseBody);
        } else if (requestPath.startsWith('/user-agent')) {
            const [_, userAgent] = requestLines[2].split(': ');
            console.log('Serving user agent: ', userAgent);
            socket.write(
                `HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: ${userAgent.length}\r\n\r\n${userAgent}`
            );
        } else if (requestPath.startsWith('/files') && process.argv[2] === '--directory') {
            const directory = process.argv[3];
            const filePath = requestPath.split('/files/')[1];
            const fullFilePath = path.join(directory, filePath);
            if (method === 'GET') {
                const acceptEncodingHeader = requestLines.find((line) => line.toLowerCase().startsWith('accept-encoding'));
                const supportedEncodings = ['gzip', 'deflate'];
                let contentEncodingHeader = '';
                if (acceptEncodingHeader) {
                    const acceptedEncodings = acceptEncodingHeader
                        .split(':')[1]
                        .trim()
                        .split(',')
                        .map((encoding) => encoding.trim().toLowerCase());
                    const supportedEncoding = acceptedEncodings.find((encoding) => supportedEncodings.includes(encoding));
                    if (supportedEncoding) {
                        contentEncodingHeader = supportedEncoding;
                    }
                }
                fs.readFile(fullFilePath, (err, data) => {
                    if (err) {
                        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                        throw err;
                    } else {
                        let responseHeaders = `HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\n`;
                        if (contentEncodingHeader === 'gzip') {
                            const compressedData = zlib.gzipSync(data);
                            responseHeaders += `Content-Encoding: ${contentEncodingHeader}\r\nContent-Length: ${compressedData.length}\r\n\r\n`;
                            socket.write(responseHeaders);
                            socket.write(compressedData);
                        } else {
                            responseHeaders += `Content-Length: ${data.length}\r\n\r\n`;
                            socket.write(responseHeaders);
                            socket.write(data);
                        }
                    }
                });
            } else if (method === 'POST') {
                fs.writeFile(fullFilePath, body, (err) => {
                    if (err) {
                        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                        throw err;
                    } else {
                        socket.write(`HTTP/1.1 201 Created\r\n\r\n`);
                    }
                });
            }
        } else {
            console.log('Serving 404.html');
            socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        }
    });
});
server.listen(4221, 'localhost')