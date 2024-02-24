import { createYoga } from 'graphql-yoga'
import { createServer } from 'node:http'
import { Context, createContext } from './context'
import { schema } from './schema'

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