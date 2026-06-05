docker stop my-product-api && docker rm my-product-api
docker build -t product-api .
docker run -d -p 3000:3000 --name my-product-api product-api
