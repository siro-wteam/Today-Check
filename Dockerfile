FROM node:22-alpine AS builder
WORKDIR /app

# EXPO_PUBLIC_ 변수는 빌드 시점에 번들에 포함 (클라이언트 공개 키)
ENV EXPO_PUBLIC_SUPABASE_URL=https://vykuftgplygojvpzbsll.supabase.co
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5a3VmdGdwbHlnb2p2cHpic2xsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDcyMjUsImV4cCI6MjA5MTc4MzIyNX0.s10GLNHx5M_WHaQZv55AQwE5Xvc7F07ILdJQERWnrDI
ENV EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyCD-TkxHlIhkMF0_EW4DlVn1Pvqvv5cfZU

COPY package*.json ./
RUN npm ci
COPY . .
RUN npx expo export -p web

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
