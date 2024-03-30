import { PrismaClient } from '@prisma/client'
import { pubSub } from './pubsub'
import { fieldEncryptionExtension } from 'prisma-field-encryption'
import { CSRF_HEADER_NAME } from './constants';
import { GraphQLError } from 'graphql';
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
  console.log(req.Headers);
  return {
    ...req,
    prisma,
    pubSub
  }
}
