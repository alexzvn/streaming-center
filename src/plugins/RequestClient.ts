import axios from 'axios'
import { env } from '~/utils/env'

export interface DStreamData {
  id: string
  session_id: string

  /**
   * your_sdp_offer
   */
  offer: string

  ice_servers: { urls: string[] }[]
}

const createDID = () => {
  const [username, password] = env('D_ID_API_KEY', 'username:password')!.split(':')

  return axios.create({
    baseURL: 'https://api.d-id.com/',
    auth: { username, password },
  })
}

export const d_id = createDID()
