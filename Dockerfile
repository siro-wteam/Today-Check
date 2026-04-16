FROM node:22-alpine AS builder
WORKDIR /app

# EXPO_PUBLIC_ 변수는 빌드 시점에 번들에 포함
# 값은 Cloud Build에서 --build-arg로 주입 (Secret Manager)
ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ARG EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
ENV EXPO_PUBLIC_SUPABASE_URL=$EXPO_PUBLIC_SUPABASE_URL
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=$EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=$EXPO_PUBLIC_GOOGLE_PLACES_API_KEY

COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx expo export -p web

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
