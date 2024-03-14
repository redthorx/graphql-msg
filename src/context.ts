import { PrismaClient } from '@prisma/client'
import { pubSub } from './pubsub'
import { fieldEncryptionExtension } from 'prisma-field-encryption'

class EncryptedPrismaClient extends PrismaClient {
  constructor(){
    super();
    return this.$extends(fieldEncryptionExtension()) as this
  }

}

const prisma = new EncryptedPrismaClient()

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
