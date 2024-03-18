import { verify } from 'jsonwebtoken'
import { Context } from './context'
import { APP_SECRET,CSRF_HEADER_NAME } from './constants'



interface Token {
  userId: string
}

export function getUserId(context: Context) {
  const authHeader = context.req.headers.authorization; 
  if(!context.req.headers[CSRF_HEADER_NAME]){
    return null;
  }
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const verifiedToken = (()=>{
      try{
        return verify(token, APP_SECRET) as Token
      }
      catch{
        
      }
      })();
    return verifiedToken && Number(verifiedToken.userId)
  }
}
export function getUserIdSubscription(unverifiedToken: String) {
  if (unverifiedToken){
  const verifiedToken = verify(unverifiedToken, APP_SECRET) as Token
  return verifiedToken && Number(verifiedToken.userId)
  }
}
