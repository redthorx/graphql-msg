import { createSchema, createYoga } from 'graphql-yoga'
import { createServer } from 'node:http'
import { Context, createContext } from './context'
import { resolvers } from './resolvers'
import { readFileSync } from 'node:fs'

export const typeDefs =  readFileSync('src/schema.graphql', 'utf8')

const schema = createSchema({
  typeDefs,
  resolvers,
})

const yoga = createYoga({
  graphqlEndpoint: '/',
  schema,
  context:createContext,
})



const server = createServer(yoga)

server.listen(5000, () => {
  console.log(`
  🚀 Server ready at: http://localhost:5000
  ⭐️ See sample queries: http://pris.ly/e/ts/graphql-sdl-first#using-the-graphql-api`)
})