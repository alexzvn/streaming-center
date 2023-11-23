import { JSONPreset } from 'lowdb/node'
import { Low } from 'lowdb'

export interface StreamDTO {
  id: string,

  /**
   * The stream id from D-ID
   */
  stream_id: string,

  /**
   * The session id from D-ID
   */
  session_id: string,
  prompt: string,

  /**
   * Path to the avatar file
   */
  avatar: string,

  /**
   * Timestamp of the last update (milliseconds)
   */
  updated_at: number,
}

export interface CommentDTO {
  id: string,

  /**
   * ID of the stream (id in StreamDTO)
   */
  stream_id: string,
  sender: string,
  message: string,

  /**
   * Timestamp of the last update (milliseconds)
   */
  created_at: number,
}

export const create = async () => await JSONPreset('./storage/db.json', {
  streams: new Array<StreamDTO>(),
  comments: new Array<CommentDTO>(),
})

