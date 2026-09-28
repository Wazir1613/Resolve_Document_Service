const { Kafka } = require("kafkajs");
const env = require("../config/env");

const kafka = new Kafka(
    {
        clientId: env.kafkaClientId,
        brokers: env.kafkaBrokers,
        retry:
            {
                retries: 0
            }
    });

const producer = kafka.producer();
let connected = false;

async function connect()
{
    if (!connected)
    {
        await producer.connect();
        connected = true;
    }
}

async function publish(topic, key, payload)
{
    await connect();

    await producer.send(
        {
            topic,
            messages: [{ key, value: JSON.stringify(payload) }]
        });
}

module.exports = { publish };