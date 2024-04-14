import { Repeater, pipe, map } from 'graphql-yoga'
import { GraphQLError } from 'graphql'
import { Context } from './context'
import { hash, compare } from 'bcryptjs'
import { sign } from 'jsonwebtoken'
import { createHash } from 'crypto'
import {  getUserId, getUserIdSubscription,getGoogleUserId } from './auth'
import { APP_SECRET, JWT_EXPIRY_SECONDS } from './constants'
import { pubSub } from './pubsub'

const applyTakeConstraints = (params: { min: number; max: number; value: number }) => {
  if (params.value < params.min || params.value > params.max) {
    throw new GraphQLError(
      `'take' argument value '${params.value}' is outside the valid range of '${params.min}' to '${params.max}'.`
    )
  }
  return params.value
}
 

export const resolvers = {
  Query: {
    allUsers: (_parent, args: { data: allUsersInput } | undefined, context: Context) => {
      if(!args){
        //backwards compatibility
        args = {
          data:{
            searchString: undefined,
            skip: undefined,
            take: undefined

          }
        }
      }
      const where = (()=>{
        if(typeof args?.data?.searchString !== 'undefined'){
          return {
            username: {
              contains: args.data.searchString
            }
          }
        }
        else{
          return {}
        }
      })();
      const take = applyTakeConstraints({
        min:1,
        max:50,
        value: args?.data?.take?? 30
      })

      return context.prisma.user.findMany({
        where,
        skip:args.data?.skip,
        take
      })
    },
    allChats: async (_parent, args: {data: allChatsInput}, context: Context) =>{
      const userId = getUserId(context);
      if(!userId){
        throw new GraphQLError(`Invalid Authorization! Check Headers! (did you miss out x-csrf?)`)
      }
      const take = applyTakeConstraints({
        min:1,
        max:50,
        value: args?.data?.take?? 30
      })
      return await context.prisma.user.findUnique({
        where: {
          id: userId
        }
      }).chats({
        where:{
          isDisabled: args.data?.disabled || false
        },
        skip:args.data?.skip,
        take,
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
      args: {data: ChatInput} ,
      context:Context,
    ) => {
      const userId = getUserId(context)
      if(!userId){
        throw new GraphQLError(`Invalid Authorization! Check Headers! (did you miss out x-csrf?)`)
      }
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
      const take = applyTakeConstraints({
        min:1,
        max:50,
        value: args?.data?.take?? 30
      })
      return await context.prisma.chat.findUnique({
        where:{
          id: args.data.chatId
        },
        include:{
          messages:{
            include:{
              user:true,
            },
            orderBy:{
              id:'desc'
            },
            skip: args.data.skip,
            take
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

      if (args.data.username.length <1 || !args.data.username.match("^[a-zA-Z0-9@.]+$")){
        throw new GraphQLError(`Please enter a valid username!`);
      }
      if (!(args.data.GoogleToken || args.data.password)){
        throw new GraphQLError(`Please enter a ID token or password!`);
      }
      const userExists = await context.prisma.user.findUnique({
        where:{
          username: args.data.username
        }
      }
      )
      if(userExists){
        throw new GraphQLError(`User already Exists!`);
      }
      let hashedPassword:string | null = null;
      let hashedGoogleID:string | null = null;
      if(args.data.password){
        hashedPassword = await hash(args.data.password, 10);
      } 
      if(args.data.GoogleToken){
        const googleId = await getGoogleUserId(args.data.GoogleToken);
        if(googleId === undefined){
          throw new GraphQLError(`Invalid Google Token!`)
        }
        else{
          hashedGoogleID = createHash('sha256').update(googleId.sub, "binary").digest("base64");
        const user = await context.prisma.user.findFirstOrThrow({
            where:{
              googleIdMD5Hash:hashedGoogleID
            }
          }
          )
          .catch(()=>{})
        if(user){
          throw new GraphQLError(`Google User Exists!`)
        }

        }
      }
      
      return context.prisma.user.create({
        data: {
          username: args.data.username,
          password_hash: hashedPassword,
          googleIdMD5Hash: hashedGoogleID
        },
      })
    },
    loginGoogleUser: async (
      _parent, 
      { GoogleToken },
      context: Context,
    ) =>{
      if(!GoogleToken){
        throw new GraphQLError(`Please enter a token!`);
      }
      const googleId = await getGoogleUserId(GoogleToken);
      if(googleId === undefined){
        throw new GraphQLError(`Invalid Google Token!`)
      }
      const hashedGoogleID = createHash('sha256').update(googleId.sub, "binary").digest("base64");
      const user = await context.prisma.user.findFirstOrThrow({
            where:{
              googleIdMD5Hash: hashedGoogleID
            }
          }).then((user)=>{return user}).catch((e)=>{})
      if(!user){
        return {
          token:null,
          user:null,
          isValidUser:false
        }
      }
      return{
        token:sign({ userId: user.id, exp:Math.floor(Date.now()/1000)+JWT_EXPIRY_SECONDS }, APP_SECRET),
        user:user,
        isValidUser:true,
      }
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
      if(!user.password_hash){ // if google signin user, password can be null
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
        throw new GraphQLError(`Invalid Authorization! Check Headers! (did you miss out x-csrf?)`)
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
            //@ts-ignore dumb bug
            connect: connectedUsers
          },
          lastUpdate: new Date()
        },
        include:{
          users: true,
          messages: true
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
        throw new GraphQLError(`Invalid Authorization! Check Headers! (did you miss out x-csrf?)`)
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
      if(isUserInChat.chats[0].isDisabled){
        throw new GraphQLError(`Chat is Disabled!`)
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
      const lastmessageStub = ()=>{
        if(args.data.body.length>10){
          return args.data.body.substring(0,10) + '...';
        }
        else{
          return args.data.body
        }
      }
      await context.prisma.chat.update({
        where:{
          id: args.data.chatId
        },
        data:{
          lastUpdate: new Date(),
          lastmessageStub: lastmessageStub() // store substring is sufficient
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

    },
    setChatStatus: async (
      __parent,
      args: {data: setChatStatusInput },
      context: Context

    ) =>{
      const userId = getUserId(context)
      if(!userId){
        throw new GraphQLError(`Invalid Authorization! Check Headers! (did you miss out x-csrf?)`)
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
      return context.prisma.chat.update({
        where:{
          id:args.data.chatId
        },
        data:{
          isDisabled:args.data.disabled
        },
        include:{
          users: true
        }
      })
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
    subscribe: async (
      _parent,
      { Token },
      context: Context,
    ) => {
      const userId = await getUserIdSubscription(Token)
      .then((userId)=>{
        if(userId){
          return userId
        }
        else{
          throw new GraphQLError(`Unable to validate user!`)
        }})
      .catch((e)=>{throw new GraphQLError(`Invalid Token!`)})
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
  password: string | undefined;
  GoogleToken: string | undefined;
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

interface allUsersInput{
  searchString: string | undefined; 
  skip: number| undefined;
  take: number| undefined;
}

interface setChatStatusInput{
  chatId: number;
  disabled: boolean;
}

interface allChatsInput{
  skip: number| undefined;
  take: number| undefined;
  disabled: boolean | undefined;
}
interface ChatInput{
  chatId: number;
  skip: number| undefined;
  take: number| undefined;
}