import { Repeater, pipe, map } from 'graphql-yoga'
import { GraphQLError } from 'graphql'
import { Context } from './context'
import { hash, compare } from 'bcryptjs'
import { sign } from 'jsonwebtoken'
import {  getUserId, getUserIdSubscription } from './auth'
import { APP_SECRET, JWT_EXPIRY_SECONDS } from './constants'
import { pubSub } from './pubsub'



export const resolvers = {
  Query: {
    allUsers: (_parent, _args, context: Context) => {
      return context.prisma.user.findMany()
    },
    allChats: async (_parent, _args, context: Context) =>{
      const userId = getUserId(context)
      if(!userId){
        throw new GraphQLError(`Invalid Authorization! Check Headers!`)
      }
      return await context.prisma.user.findUnique({
        where: {
          id: userId
        }
      }).chats({
        include:({
          messages:{
            take:5,
            orderBy:{
              id:'desc'
            },
            include:{
              user:true
            }
          },
          users:true
        }),
        orderBy:{
          lastUpdate:"desc"
        }
      })

    },
    Chat: async (
      _parent, 
      { chatId },
      context:Context,
    ) => {
      const userId = getUserId(context)
      if(!userId){
        throw new GraphQLError(`Invalid Authorization! Check Headers!`)
      }
      const isUserInChat = await context.prisma.user.findUnique({
        where:{
          id:userId
        },
        include:{
          chats:{
            where:{
              id: chatId
            }
          }
        }
      })
      //user is not in chat
      if (!isUserInChat?.chats.length){
        throw new GraphQLError(`You do not belong in the chat!`)
      }
      return await context.prisma.chat.findUnique({
        where:{
          id: chatId
        },
        include:{
          messages:{
            include:{
              user:true,
            },
            orderBy:{
              id:'desc'
            }
          },
          users:true
        }
      })
    }
    
  },
  Mutation: {
     signupUser: async (
      _parent,
      args: { data: UserCreateInput },
      context: Context,
    ) => {
      if (args.data.username.length <1 || args.data.password.length <1 || !args.data.username.match("^[a-zA-Z0-9]+$")){
        throw new GraphQLError(`Please enter a valid username and password!`);
      }
      const hashedPassword = await hash(args.data.password, 10)
      return context.prisma.user.create({
        data: {
          username: args.data.username,
          password_hash: hashedPassword
        },
      })
    },
    loginUser: async (
      _parent,
      args: { data: LoginUserInput},
      context: Context,
    ) => {
      const user = await context.prisma.user.findUnique({
        where:{
          username: args.data.username
        }
      }
      )
      if(!user){
        throw new GraphQLError(`Invalid Login!`)
      }
      const passwordValid = await compare(args.data.password, user.password_hash)
      if (!passwordValid) {
        throw new GraphQLError('Invalid Login!')
      }
      return {
        token: sign({ userId: user.id, exp:Math.floor(Date.now()/1000)+JWT_EXPIRY_SECONDS }, APP_SECRET),
        user,
      }

    },
    createChat: async (
      _parent,
      args: {data: CreateChatInput},
      context: Context,

    ) => {
      const _self_user = getUserId(context);
      if(!_self_user){
        throw new GraphQLError(`Invalid Authorization! Check Headers!`)
      }
      //check if all users in list is valid
      const target_users = await Promise.all(
        args.data.targetUsernames.map(async (username)=> {
        let target_user = await context.prisma.user.findUnique({
          where:{
            username:username
          }
          
        })
        if (!target_user){
          throw new GraphQLError('Invalid username ${username}!');
        }
        if (target_user.id === _self_user){
          throw new GraphQLError(`You do not need to put yourself in the chat!`);
        }
        return target_user;
      })
      )
      // Create chat with self and target users
      const connectedUsers = [{ id: _self_user }, ...target_users];
      const createdChat = await context.prisma.chat.create({
        data: {
          users: {
            connect: connectedUsers
          },
          lastUpdate: new Date()
        },
      });
      //publish to all connectedusers
      connectedUsers.forEach((user)=>{
        pubSub.publish('newChat',user.id,{chat: createdChat});
      })
      return createdChat;

    },
    sendMessage: async (
      _parent,
      args: {data: sendMessageInput},
      context: Context,
    ) =>{
      const userId = getUserId(context)
      if(!userId){
        throw new GraphQLError(`Invalid Authorization! Check Headers!`)
      }
      //find out if chat is valid for users
      const isUserInChat = await context.prisma.user.findUnique({
        where:{
          id:userId
        },
        include:{
          chats:{
            where:{
              id: args.data.chatId
            }
          }
        }
      })
      //user is not in chat
      if (!isUserInChat?.chats.length){
        throw new GraphQLError(`You do not belong in the chat!`)
      }
      const createdMessage = await context.prisma.message.create({
        data:{
          userId:userId,
          chatId: args.data.chatId,
          body: args.data.body
        },
        include:{
          user:true,
          chat:true
        }
      });
      //update chat last updated time
      await context.prisma.chat.update({
        where:{
          id: args.data.chatId
        },
        data:{
          lastUpdate: new Date(),
        }
      });
      //find users who are in chat
      const usersInChat = await context.prisma.chat.findUnique({
        where:{
          id:  args.data.chatId
        },
        include:{
          users:true
        }
      });
      if(usersInChat?.users){
        usersInChat.users.forEach((user)=>{
          pubSub.publish('newMessage',user.id,{ message: 
            createdMessage });
        })
      }
      return createdMessage;

    }


},
Subscription: {
  countdown: {
    // This will return the value on every 1 sec until it reaches 0
    subscribe: async function* (_, { from }) {
      for (let i = from; i >= 0; i--) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        yield { countdown: i }
      }
    }
  },
  userUpdate:{
    subscribe: (
      _parent,
      { Token },
      context: Context,
    ) =>{
      const userId = (()=>{
      try{
          return getUserIdSubscription(Token);
        }
        catch(error){
          throw new GraphQLError(`Invalid Token!`)
        }
      })();
      if (!userId){
        throw new GraphQLError(`Unable to validate user!`)
      }
      return pipe(
            Repeater.merge([
            context.pubSub.subscribe('newChat',userId),
            context.pubSub.subscribe('newMessage',userId)
          ])
        )
      
    },
    resolve: payload => payload
  }
}
}

enum SortOrder {
  asc = 'asc',
  desc = 'desc',
}

interface UserCreateInput {
  username: string;
  password: string;
}

interface LoginUserInput{
  username: string;
  password: string;
}

interface CreateChatInput{
  targetUsernames: string[];
}

interface sendMessageInput{
  chatId: number;
  body: string;

}


