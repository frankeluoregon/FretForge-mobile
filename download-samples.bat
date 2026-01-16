@echo off
echo Downloading instrument samples from tonejs-instruments...
echo.

set BASE_URL=https://nbrosowsky.github.io/tonejs-instruments/samples

echo Downloading Guitar Acoustic samples...
curl -L -o samples/guitar-acoustic/A2.mp3 %BASE_URL%/guitar-acoustic/A2.mp3
curl -L -o samples/guitar-acoustic/A3.mp3 %BASE_URL%/guitar-acoustic/A3.mp3
curl -L -o samples/guitar-acoustic/A4.mp3 %BASE_URL%/guitar-acoustic/A4.mp3
curl -L -o samples/guitar-acoustic/C3.mp3 %BASE_URL%/guitar-acoustic/C3.mp3
curl -L -o samples/guitar-acoustic/C4.mp3 %BASE_URL%/guitar-acoustic/C4.mp3
curl -L -o samples/guitar-acoustic/C5.mp3 %BASE_URL%/guitar-acoustic/C5.mp3
curl -L -o samples/guitar-acoustic/Ds3.mp3 %BASE_URL%/guitar-acoustic/Ds3.mp3
curl -L -o samples/guitar-acoustic/Ds4.mp3 %BASE_URL%/guitar-acoustic/Ds4.mp3
curl -L -o samples/guitar-acoustic/Fs2.mp3 %BASE_URL%/guitar-acoustic/Fs2.mp3
curl -L -o samples/guitar-acoustic/Fs3.mp3 %BASE_URL%/guitar-acoustic/Fs3.mp3
curl -L -o samples/guitar-acoustic/Fs4.mp3 %BASE_URL%/guitar-acoustic/Fs4.mp3

echo.
echo Downloading Guitar Nylon samples...
curl -L -o samples/guitar-nylon/A2.mp3 %BASE_URL%/guitar-nylon/A2.mp3
curl -L -o samples/guitar-nylon/A3.mp3 %BASE_URL%/guitar-nylon/A3.mp3
curl -L -o samples/guitar-nylon/A4.mp3 %BASE_URL%/guitar-nylon/A4.mp3
curl -L -o samples/guitar-nylon/C3.mp3 %BASE_URL%/guitar-nylon/C3.mp3
curl -L -o samples/guitar-nylon/C4.mp3 %BASE_URL%/guitar-nylon/C4.mp3
curl -L -o samples/guitar-nylon/C5.mp3 %BASE_URL%/guitar-nylon/C5.mp3
curl -L -o samples/guitar-nylon/Ds3.mp3 %BASE_URL%/guitar-nylon/Ds3.mp3
curl -L -o samples/guitar-nylon/Ds4.mp3 %BASE_URL%/guitar-nylon/Ds4.mp3
curl -L -o samples/guitar-nylon/Fs2.mp3 %BASE_URL%/guitar-nylon/Fs2.mp3
curl -L -o samples/guitar-nylon/Fs3.mp3 %BASE_URL%/guitar-nylon/Fs3.mp3
curl -L -o samples/guitar-nylon/Fs4.mp3 %BASE_URL%/guitar-nylon/Fs4.mp3

echo.
echo Downloading Bass Electric samples...
curl -L -o samples/bass-electric/A1.mp3 %BASE_URL%/bass-electric/A1.mp3
curl -L -o samples/bass-electric/A2.mp3 %BASE_URL%/bass-electric/A2.mp3
curl -L -o samples/bass-electric/C1.mp3 %BASE_URL%/bass-electric/C1.mp3
curl -L -o samples/bass-electric/C2.mp3 %BASE_URL%/bass-electric/C2.mp3
curl -L -o samples/bass-electric/Ds1.mp3 %BASE_URL%/bass-electric/Ds1.mp3
curl -L -o samples/bass-electric/Ds2.mp3 %BASE_URL%/bass-electric/Ds2.mp3
curl -L -o samples/bass-electric/Fs1.mp3 %BASE_URL%/bass-electric/Fs1.mp3
curl -L -o samples/bass-electric/Fs2.mp3 %BASE_URL%/bass-electric/Fs2.mp3

echo.
echo Download complete!
echo Samples are now in the 'samples' folder.
pause
