import mongoose from 'mongoose';
import { config } from './config';

export async function connectDb(): Promise<void> {
  // Inyección de operadores $: mitigada en el borde — todo input pasa por Zod
  // (strings/enums/números), nunca objetos arbitrarios a filtros de Mongoose.
  await mongoose.connect(config.mongoUrl);
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
