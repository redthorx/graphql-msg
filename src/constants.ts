export const APP_SECRET = process.env.APP_SECRET
export const JWT_EXPIRY_SECONDS = (()=>{
    if(!process.env.JWT_EXPIRY_SECONDS){
        return 7200;
    }
    else{
        return Number(process.env.JWT_EXPIRY_SECONDS);
    }
})();
export const ORIGIN_SERVER = process.env.ORIGIN_SERVER  
export const CSRF_HEADER_NAME = process.env.CSRF_HEADER_NAME || 'x-csrf'