const fs = require('fs');
let content = fs.readFileSync('index.js', 'utf8');

// 替换 ADMIN_OPENIDS
const oldAdmin = "const ADMIN_OPENIDS = [\n  'o1vza4lDAMQeVaoL2xdW4E_xmJCs'\n];";
const newAdmin = "const ADMIN_OPENIDS = [\n  'o1vza4lDAMQeVaoL2xdW4E_xmJCs',\n  'o1vza4qmggBW1NhFzRmfdvDU-J_c'\n];";

content = content.replace(oldAdmin, newAdmin);

fs.writeFileSync('index.js', content, 'utf8');
console.log('ADMIN_OPENIDS 已更新');
