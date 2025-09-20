export const getTimeStamp=()=>{
    const date=new Date();
    const year= date.getFullYear();
    const month= String(date.getMonth() +1).padStart(2,'0')
    const day= String(date.getDate()).padStart(2,'0')
    const hours=String(date.getHours()).padStart(2, '0')
    const minutes=String(date.getMinutes()).padStart(2, '0')
    const seconds= String(date.getSeconds()).padStart(2, '0')

    return `${year}${month}${day}${hours}${minutes}${seconds}`
}

export const getPassword=(timeStamp)=>{
    const shortCode=process.env.BUSINESS_SHORT_CODE;
    const passKey=process.env.PASS_KEY;
    const password= `${shortCode}${passKey}${timeStamp}`;
    return Buffer.from(password).toString('base64')
}


export const getAccessToken=async()=>{
    try{
        const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
        const auth = Buffer.from(`${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`).toString('base64');

        const response=await axios.get(url,{
            headers:{
                'Authorization':"Basic ${auth"
            }
        })
        return response.data.access_token

    }catch(err){
console.error("Error getting access token:", err);
throw err
    }
}