const crypto = require('crypto');

function getHash(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

const candidates = [
    "1212",
    "chicvill02",
    "chicvill",
    "1234",
    "1111",
    "5871301146",
    "01082817377",
    "김종심"
];

console.log("Target Hash: 139d00f9d578b4ab032cfaca61abf5cda72aa01b8fc09c069145d13960c753ac");
candidates.forEach(c => {
    console.log(`Candidate: "${c}" -> Hash: ${getHash(c)}`);
});
