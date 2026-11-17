const NodeClam = require("clamscan");
const { Readable } = require("stream");
const env = require("../config/env");

let clamscanInstance = null;

async function getClamscan()
{
    if (!clamscanInstance)
    {
        clamscanInstance = await new NodeClam().init({
            clamdscan: {
                host: env.clamavHost,
                port: env.clamavPort
            }
        });
    }

    return clamscanInstance;
}

async function scanBuffer(buffer)
{
    const clamscan = await getClamscan();
    const stream = Readable.from(buffer);
    const { isInfected } = await clamscan.scanStream(stream);
    return isInfected ? "INFECTED" : "CLEAN";
}

module.exports = { scanBuffer };