# Flixor

This project is a fork of [Plexy](https://github.com/ricoloic/plexy) at commit `859ec9343920601d41069f1d6da15bf6cc335096`, which itself was forked from [PerPlexed](https://github.com/Ipmake/PerPlexed). It aims to provide an alternative web UI for the Plex app, inspired by Netflix's user interface.

## Recent Changes

### Key Enhancements

1. **Video Player Controls**: 
   - Added seek forward and backward controls to the video player, enhancing user navigation within media content.
   - Updated the inline video control UI for a more intuitive user experience.

2. **Library View Enhancements**:
   - Introduced a "Watched" label in the Library View to easily identify viewed content.
   - Implemented a context menu feature to mark or unmark content as watched throughout the app.

3. **UI and Navigation Improvements**:
   - Enhanced the title image display and provided a backup method for missing images.
   - Improved library hover effects and navigation updates for a smoother user experience.
   - Updated methods to retrieve direct streams, ensuring better media playback reliability.
4. **License Update**:
- Added the GNU License to the project, ensuring open-source compliance and clarity.

## Installation via Docker

### **Prerequisites**
Ensure you have the following installed on your system:
- Docker: [Install Docker](https://docs.docker.com/get-docker/)

---

### **Steps to Build and Run**
### **1. Clone the Repository**
Clone the repository containing the `Dockerfile` and application source code:
```bash
git clone https://github.com/Flixorui/flixor.git
cd flixor
```

---

### **2. Build the Docker Image**
Use the following command to build the Docker image:
```bash
docker build -t flixor:latest .
```

This command:
- Reads the `Dockerfile`.
- Builds the image and tags it as `flixor:latest`.

---

### **3. Run the Docker Container**
Run a container from the built image:
```bash
docker run -d -p 3000:3000 --name flixor-app flixor:latest
```

This command:
- Runs the container in detached mode (`-d`).
- Maps port `3000` on your machine to port `3000` in the container.
- Names the container `flixor-app`.

---

### **4. Access the Application**
Once the container is running, you can access the application in your browser or via a tool like `curl` at:
```
http://localhost:3000
```

---

### **5. Stop the Container**
To stop the running container, use:
```bash
docker stop flixor-app
```

---

### **6. Remove the Container**
If you want to remove the container, run:
```bash
docker rm flixor-app
```

---

### **7. Optional: Clean Up**
To remove the Docker image:
```bash
docker rmi flixor:latest
```

---

## **Development Workflow**
- **Make Changes**: Modify the source code as needed.
- **Rebuild the Image**: Rebuild the Docker image to include your changes:
  ```bash
  docker build -t flixor:latest .
  ```

---

## **Troubleshooting**
- **Port Already in Use**: Ensure port `3000` is not being used by another application.
- **Verify Running Containers**: Check if the container is running:
  ```bash
  docker ps
  ```
- **Inspect Logs**: View container logs for debugging:
  ```bash
  docker logs flixor-app
  ```

---
<br>

## Development
### **Prerequisites**
Ensure you have the following installed on your system:
- NVM: [Install NVM](https://github.com/nvm-sh/nvm) [optional]
- Node.js: [Install Node.js v20](https://nodejs.org/en/download/)
- pnpm: [Install pnpm](https://pnpm.io/installation)

To set up a development environment, follow these steps:

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/your-repo.git
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to view the app.

## License

This project is licensed under the GNU License. See the [LICENSE](LICENSE) file for more details.

## Acknowledgments

- [Plexy](https://github.com/ricoloic/plexy) for the initial fork and development.
- [PerPlexed](https://github.com/Ipmake/PerPlexed) for the original UI redesign concept.
