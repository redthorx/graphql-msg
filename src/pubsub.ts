import { createPubSub } from "graphql-yoga";
import { Chat, Message } from '@prisma/client'
 
export type PubSubChannels = {
  newChat: [userId: number, payload:{ chat: Chat }]
  newMessage: [userId: number, payload:{ message: Message }]
}
 
export const pubSub = createPubSub<PubSubChannels>()