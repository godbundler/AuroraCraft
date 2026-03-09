export interface User {
  id: string
  username: string
  email: string
  role: 'user' | 'admin'
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  type: 'plugin'
  isPublic: boolean
  software: string
  language: 'java' | 'kotlin'
  javaVersion: string
  compiler: 'maven' | 'gradle'
  createdAt: string
  updatedAt: string
}

export interface ApiError {
  message: string
  statusCode: number
}
