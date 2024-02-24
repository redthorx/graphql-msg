import { PrismaClient } from '@prisma/client'
import { pubSub } from './pubsub'

const prisma = new PrismaClient()

export interface Context {
  prisma: PrismaClient
  req: any // HTTP request carrying the `Authorization` header
  pubSub: typeof pubSub
}

export function createContext(req: any) {
  return {
    ...req,
    prisma,
    pubSub
  }
}
