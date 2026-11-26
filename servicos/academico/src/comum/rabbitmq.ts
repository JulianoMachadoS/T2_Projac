import { RmqOptions, Transport } from '@nestjs/microservices';

const URL = process.env.RABBITMQ_URL ?? 'amqp://projac:projac@rabbitmq:5672';

// filas e DLQ ja vem declaradas em infra/rabbitmq/definitions.json, por isso noAssert

// para publicar numa fila
export function publicarEm(fila: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: { urls: [URL], queue: fila, noAssert: true, persistent: true }, // persistent: sobrevive a reinicio do RabbitMQ
  };
}

// para consumir uma fila
export function consumir(fila: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [URL],
      queue: fila,
      noAssert: true,
      noAck: false, // ack manual: so confirma depois de processar
      prefetchCount: 1,
    },
  };
}
