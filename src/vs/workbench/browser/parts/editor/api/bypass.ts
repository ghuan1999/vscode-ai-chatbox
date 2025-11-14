import https from 'https';
import fs from 'fs';
import path from 'path';
import express from 'express';

const app = express(); // đổi 'out' thành folder bạn muốn serve

const options = {
	key: fs.readFileSync('bypass.vnexpress.net+2-key.pem'),
	cert: fs.readFileSync('bypass.vnexpress.net+2.pem')
};

https.createServer(options, app).listen(8443);
