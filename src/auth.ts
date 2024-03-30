import { verify } from 'jsonwebtoken'
import { Context } from './context'
import { APP_SECRET,CSRF_HEADER_NAME, GOOGLE_CLIENT_IDS } from './constants'
import { OAuth2Client } from 'google-auth-library'


interface Token {
  userId: string
}

async function verifyGoogleIdToken(Token:string){
  const client = new OAuth2Client();
  try{
      const ticket = await client.verifyIdToken({
        idToken: Token,
      });
      const payload = await ticket.getPayload();
      return payload;
    }
  catch{
  }

}

export async function getGoogleUserId(unverifedGoogleIdToken:string){
  const verifiedToken = await verifyGoogleIdToken(unverifedGoogleIdToken);
  if(verifiedToken){
    return verifiedToken
  }
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
export async function getUserIdSubscription(unverifiedToken: String) {
  if (unverifiedToken){
  const verifiedToken = await verify(unverifiedToken, APP_SECRET) as Token
  return verifiedToken && Number(verifiedToken.userId)
  }
}
