import { YogaServer, createSchema, createYoga } from 'graphql-yoga'
import { createServer } from 'node:http'
import ws from 'ws'
import { useServer } from 'graphql-ws/lib/use/ws'
import { Context, createContext } from './context'
import { resolvers } from './resolvers'
import { readFileSync } from 'node:fs'

export const typeDefs =  readFileSync('src/schema.graphql', 'utf8')
const port = process.env.PORT || 5000
const schema = createSchema({
  typeDefs,
  resolvers,
})

const yoga = createYoga({
  graphiql:{
    subscriptionsProtocol: 'WS'
  },
  graphqlEndpoint: '/',
  schema,
  context:createContext,
})



const httpserver = createServer(yoga)
const wsServer = new ws.Server({
  server: httpserver,
  path: yoga.graphqlEndpoint,
  context: createContext

})
useServer({
  execute:(args:any) => args.rootValue.execute(args),
  subscribe: (args:any) => args.rootValue.subscribe(args),
  onSubscribe: async (ctx, msg) => {
    const { schema, execute, subscribe, contextFactory, parse, validate} = yoga.getEnveloped({
      ...ctx,
      req: ctx.extra.request,
      socket: ctx.extra.socket,
      params: msg.payload
    })
    const args = {
      schema,
      operationName: msg.payload.operationName,
      document: parse(msg.payload.query),
      variableValues: msg.payload.variables,
      contextValue: await contextFactory(),
      rootValue: {
        execute,
        subscribe
      }
    }

    const errors = validate(args.schema, args.document)
    if (errors.length) return errors
    return args
  },
  },
  wsServer
  )

httpserver.listen(port, () => {
  console.log(`
  🚀 Server ready at: http://localhost:${port}
  ⭐️ See sample queries: http://pris.ly/e/ts/graphql-sdl-first#using-the-graphql-api`)
})