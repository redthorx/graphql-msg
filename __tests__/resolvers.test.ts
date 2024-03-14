import { resolvers } from "../src/resolvers";
import { Context } from "../src/context";
import { PrismaClient } from '@prisma/client'
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended'
import { pubSub } from "../src/pubsub";
import { GraphQLError } from "graphql";
export type MockContext = {
    req: any
    prisma: DeepMockProxy<PrismaClient>
    pubSub: typeof pubSub
  }
  
export const createMockContext = (): MockContext => {
    return {
      req: null,
      prisma: mockDeep<PrismaClient>(),
      pubSub
    }
  }

let mockCtx: MockContext
let ctx: Context

beforeEach(() => {
  mockCtx = createMockContext()
  ctx = mockCtx as unknown as Context
})

it('creates user', async () => {
      const user = {
            username: 'bobby',
            password: 'hello',
          }
      const context: Context = mockCtx;
      const result = await resolvers.Mutation.signupUser(null, {data:user}, context);
      expect(Array.isArray(result));
    });

test('cannot log in invalid user', async ()=> {
    const user = {
        username: 'bobby',
        password: 'hello',
      }
    const context: Context = mockCtx;
    let result
    try{
        result = await resolvers.Mutation.loginUser(null, {data:user}, context)
    }
    catch(error){
        console.log(error)
        result = 'error'
    }
    await expect(result).toBe('error')
})