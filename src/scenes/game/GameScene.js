import 'phaser';
import isEqual from 'is-equal';
import { watchStore } from '../../utils/watchStore';
import { gameStore, gameController } from './logic';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'Game' });

    this.keyPress = null;
    this.pointer = null;
    this.player = null;
    this.platforms = null;
    this.stars = null;
    this.bombs = null;
    this.scoreText = null;
    this.nivelText = null;
    this.playerbombCollider = null;

    // The gameStore (a redux store) and change handlers
    this.gameStore = gameStore;
    this.gameOver = this.gameOver.bind(this);
    this.handleMovePlayer = this.handleMovePlayer.bind(this);
    this.renderScoreValue = this.renderScoreValue.bind(this);

    //Se usa en update () para limitar las llamadas de despacho
    this.lastMoveTo = null;
  }

  init() { }

  preload() {
    // Imagenes
    this.load.image('sky', 'assets/fondo7.jpg'   );
    this.load.image('ground', 'assets/platform.png');
    this.load.image('star', 'assets/libro4.png');
    this.load.image('bomb', 'assets/bomb.png');
    this.load.spritesheet('dude', 'assets/dude.png', { frameWidth: 32, frameHeight: 48 });

    // Cuando state.objectPath cambie, ejecute la función onChange
    // Por ejemplo: cuando gameController.velocity cambie, ejecute handleMovePlayer
    const storeMonitor = [
      { objectPath: 'gameController.gameOver', onChange: this.gameOver },
      { objectPath: 'gameController.score', onChange: this.renderScoreValue },
      { objectPath: 'gameController.velocity', onChange: this.handleMovePlayer }
    ];
    watchStore(gameStore, storeMonitor);
  }

  create() {
    // Un fondo simple para nuestro juego
    this.add.image(400, 300, 'sky');
    // Las plataformas contienen el suelo y las repisas sobre las que podemos saltar.
    this.platforms = createPlatforms(this);

    // El jugador y su configuración
    this.player = createPlayer(this);

    // Animaciones del jugador
    createAnimations(this);

    // Eventos de entrada
    this.keyPress = this.input.keyboard.createCursorKeys();
    this.input.on('pointerdown', function (pointer) {
      // eslint-disable-next- line no-invalid-this
      this.pointer = {
        isDown: 25,
        x: pointer.x,
        y: pointer.y
      };
    }, this);

    //  Algunas estrellas para coleccionar
    this.stars = createStars(this);

    // El enemigo
    this.bombs = this.physics.add.group();

    // Agrega una bomba 
    addBomb(this.bombs, this.player);
    
    //  El marcador
    this.scoreText = this.add.text(16, 16, 'Puntaje: 0', {  fontSize: '32px', fill: '#FFF', fontFamily: '"Roboto Condensed"' });
   
    
    this.nivelText = this.add.text(16,50 , 'nivel: 1', { fontSize: '32px', fill: '#FFF', fontFamily: '"Roboto Condensed"' });
    //  Choca al jugador, las estrellas y las bombas con las plataformas
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.stars, this.platforms);
    this.physics.add.collider(this.bombs, this.platforms);

    //  Comprueba si el jugador se superpone con alguna de las estrellas, si llama a la función collectStar

    this.physics.add.overlap(this.player, this.stars, this.collectStar, null, this);

    //  Comprueba si el jugador choca con alguna de las bombas.

    this.playerbombCollider = this.physics.add.collider(this.player, this.bombs, this.hitBomb, null, this);
  }

  // eslint-disable-next-line no-unused-vars
  update(time, delta) {
    const actualState = this.gameStore.getState();
    
    // Regresar si el juego

    if (actualState.gameController.gameOver) {
      return;
    }

    // Inmunidad al empiezo del juego
    this.playerbombCollider.active = actualState.gameController.inmunity < 0;

    // entrada
    const nextMoveTo = getNextMoveTo(this);

    // Inicia moveTo action en el juego. Esta acción establece la velocidad
    if (!isEqual(nextMoveTo, this.lastMoveTo)) {
      this.lastMoveTo = nextMoveTo;
      this.gameStore.dispatch(gameController.actions.moveTo(nextMoveTo));
    }

    // Guardar información en estado
    saveInfo(this);
  }

  // eslint-disable-next-line no-unused-vars
  gameOver(newVal, oldVal, objectPath) {
    if (newVal) {
      this.physics.pause();
      this.player.setTint(0xff0000);
      this.player.anims.play('turn');
    }
  }

  // eslint-disable-next-line no-unused-vars
  handleMovePlayer(newVal, oldVal, objectPath) {
    this.player.setVelocityX(newVal.x);
    this.player.setVelocityY(newVal.y);
    this.player.anims.play(newVal.animation, true);
  }

  // eslint-disable-next-line no-unused-vars
  renderScoreValue(newVal, oldVal, objectPath) {
    this.scoreText.setText('puntaje: ' + newVal);
    this.nivelText.setText('nivel:1')
  }

  // eslint-disable-next-line no-unused-vars
  collectStar(player, star) {
    star.disableBody(true, true);

    // Actualiza el estado del juego
    this.gameStore.dispatch(gameController.actions.collision('star'));

    // comprueba las estrellas activas
    if (this.stars.countActive(true) === 0) {
      // Un nuevo lote de estrellas para coleccionar      
      this.stars.children.iterate(child => {
        child.enableBody(true, child.x, 0, true, true);
  
      });

      // Crea una nueva bomba
      addBomb(this.bombs, this.player );
  
    }
  }

  // eslint-disable-next-line no-unused-vars
  hitBomb(player, bomb) {
    // Actualiza el estado del juego
    this.gameStore.dispatch(gameController.actions.collision('bomb'));
  }
}

const getNextMoveTo = (that) => {
  let next = {
    left: false,
    right: false,
    up: false
  };

  // puntero
  if (that.pointer && that.pointer.isDown > 0) {
    const difX = Math.abs(that.pointer.x - that.player.body.position.x);
    const difY = Math.abs(that.pointer.y - that.player.body.position.y);
    if (difY > difX) {
      next.up = that.pointer.y < that.player.body.position.y;
    } else {
      next.right = that.pointer.x > that.player.body.position.x;
      next.left = that.pointer.x < that.player.body.position.x;
    }
    that.pointer.isDown--;
  } else {
    // teclado
    next = {
      left: that.keyPress.left.isDown,
      right: that.keyPress.right.isDown,
      up: that.keyPress.up.isDown
    };
  }

  return next;
};

const saveInfo = (that) => {
  const info = {
    player: {
      x: parseInt(that.player.body.position.x),
      y: parseInt(that.player.body.position.y)
    }
  };
  that.gameStore.dispatch(gameController.actions.setInfo(info));
};

const createPlayer = (that) => {
  // el jugador y su configuracion
  const player = that.physics.add.sprite(100, 450, 'dude');

  //  Propiedades físicas del jugador. Dale un pequeño rebote al pequeño.
  player.setBounce(0.2);
  player.setCollideWorldBounds(true);

  return player;
};

const createPlatforms = (that) => {
  //  El grupo de plataformas contiene el suelo y las 2 repisas sobre las que podemos saltar.
  const platforms = that.physics.add.staticGroup();

  //  aqui creamos el terreno
  //  Ajústalo para que se ajuste al ancho del juego (el sprite original tiene un tamaño de 400x32)

  platforms.create(400, 568, 'ground').setScale(2).refreshBody();

  //  Ahora creemos algunas repisas
  platforms.create(600, 400, 'ground');
  platforms.create(50, 250, 'ground');
  platforms.create(750, 220, 'ground');

  return platforms;
};

const createAnimations = (that) => {
  //  Nuestras animaciones de jugador, girando, caminando a la izquierda y caminando a la derecha.

  that.anims.create({
    key: 'left',
    frames: that.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
    frameRate: 10,
    repeat: -1
  });

  that.anims.create({
    key: 'turn',
    frames: [{ key: 'dude', frame: 4 }],
    frameRate: 20
  });

  that.anims.create({
    key: 'right',
    frames: that.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
    frameRate: 10,
    repeat: -1
  });
};

const createStars = (that) => {
  const configStars = 12;
  const configStepX = parseInt(that.game.config.width / (configStars + 1));
  
  //  Algunas estrellas para coleccionar
  const stars = that.physics.add.group({
    
    key: 'star',
    repeat: configStars - 1 ,
    setXY: { x: configStars / 2, y: 0, stepX: configStepX }
    
  });
  stars.children.iterate(function (child) {
    //  Dale a cada estrella un rebote ligeramente diferente
    child.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
  });

  return stars;
};

const addBomb = (bombs, player) => {
  // Agregue una bomba al grupo de bombas, cerca de la posición del jugador
  const x = (player.x < 400) ? Phaser.Math.Between(400, 800) : Phaser.Math.Between(0, 400);
  const bomb = bombs.create(x, 16, 'bomb');
  bomb.setBounce(1);
  bomb.setCollideWorldBounds(true);
  bomb.setVelocity(Phaser.Math.Between(-200, 200), 20);
  bomb.allowGravity = false;
  
};
