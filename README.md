1. docker stop my-product-api && docker rm my-product-api
2. docker build -t product-api .
3. docker run -d -p 3000:3000 --name my-product-api product-api
