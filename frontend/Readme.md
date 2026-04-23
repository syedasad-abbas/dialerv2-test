#for package-lock.jason
cd /home/tpl/compare/dialerv2/frontend
docker run --rm -it \
  -v "$PWD:/app" -w /app \
  node:20-alpine sh -lc "npm install"
#buiding an image 
    docker build -t syedasadabbas/dialerv2-frontend:0.1 .
#checking logs of the frontend 
    kubectl logs -n dialerv2test deploy/dialer-freeswitch -c frontend --tail=100
#forwording a frontend login port 
kubectl -n dialerv2test port-forward deployment/dialer-freeswitch 8088:8088

#browser access 
http://localhost:8088/login